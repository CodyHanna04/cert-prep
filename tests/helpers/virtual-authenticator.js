import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";

/**
 * A software WebAuthn authenticator for tests: ES256 keys, "none" attestation, optional user-verification flag.
 * Produces the same JSON shapes a browser sends to the server.
 */

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const sha256 = (data) => createHash("sha256").update(data).digest();

// Minimal CBOR encoders for the few shapes WebAuthn needs.
const cborBytes = (buf) =>
  buf.length < 256 ? Buffer.concat([Buffer.from([0x58, buf.length]), buf]) : Buffer.concat([Buffer.from([0x59, buf.length >> 8, buf.length & 255]), buf]);
const cborText = (s) => Buffer.concat([Buffer.from([0x60 + s.length]), Buffer.from(s)]);

export class VirtualAuthenticator {
  constructor({ origin, rpId, userVerified = true }) {
    this.origin = origin;
    this.rpId = rpId;
    this.userVerified = userVerified;
    const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    this.privateKey = privateKey;
    this.jwk = publicKey.export({ format: "jwk" });
    this.credentialId = randomBytes(32);
    this.counter = 0;
  }

  get id() {
    return b64u(this.credentialId);
  }

  #flags(extra = 0) {
    return 0x01 | (this.userVerified ? 0x04 : 0) | extra; // UP | UV?
  }

  /** @param {{ challenge: string, user: { id: string } }} options from generate-register-options */
  createCredential(options) {
    const clientDataJSON = Buffer.from(
      JSON.stringify({ type: "webauthn.create", challenge: options.challenge, origin: this.origin, crossOrigin: false }),
    );
    const x = Buffer.from(this.jwk.x, "base64url");
    const y = Buffer.from(this.jwk.y, "base64url");
    const coseKey = Buffer.concat([
      Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
      x,
      Buffer.from([0x22, 0x58, 0x20]),
      y,
    ]);
    const counter = Buffer.alloc(4);
    const authData = Buffer.concat([
      sha256(this.rpId),
      Buffer.from([this.#flags(0x40)]), // AT: attested credential data present
      counter,
      Buffer.alloc(16), // aaguid
      Buffer.from([this.credentialId.length >> 8, this.credentialId.length & 255]),
      this.credentialId,
      coseKey,
    ]);
    const attestationObject = Buffer.concat([
      Buffer.from([0xa3]),
      cborText("fmt"),
      cborText("none"),
      cborText("attStmt"),
      Buffer.from([0xa0]),
      cborText("authData"),
      cborBytes(authData),
    ]);
    return {
      id: this.id,
      rawId: this.id,
      type: "public-key",
      response: { clientDataJSON: b64u(clientDataJSON), attestationObject: b64u(attestationObject), transports: ["internal"] },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    };
  }

  /** @param {{ challenge: string }} options from generate-authenticate-options */
  getAssertion(options) {
    const clientDataJSON = Buffer.from(
      JSON.stringify({ type: "webauthn.get", challenge: options.challenge, origin: this.origin, crossOrigin: false }),
    );
    this.counter += 1;
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(this.counter);
    const authenticatorData = Buffer.concat([sha256(this.rpId), Buffer.from([this.#flags()]), counter]);
    const signature = sign("sha256", Buffer.concat([authenticatorData, sha256(clientDataJSON)]), this.privateKey);
    return {
      id: this.id,
      rawId: this.id,
      type: "public-key",
      response: {
        authenticatorData: b64u(authenticatorData),
        clientDataJSON: b64u(clientDataJSON),
        signature: b64u(signature),
      },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    };
  }
}
