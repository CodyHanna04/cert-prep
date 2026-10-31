import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  { ignores: [".next/**", "node_modules/**", "content/**"] },
  {
    // Application code reaches the database only through the server-only data layer (docs/11 section 3).
    files: ["app/**/*.js", "components/**/*.js", "lib/app/**/*.js", "lib/domain/**/*.js", "lib/content/**/*.js"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "pg", message: "Use withUser() from @/lib/db/index.js; pg is for lib/db and lib/auth only." }],
          patterns: [{ group: ["**/lib/db/with-user.js", "**/db/with-user.js"], message: "Import withUser from @/lib/db/index.js." }],
        },
      ],
    },
  },
  { rules: { "react/no-unescaped-entities": "off" } },
];

export default config;
