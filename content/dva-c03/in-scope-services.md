# DVA-C03 in-scope / out-of-scope services

Transcribed from the official exam guide (DVA-C03; pages 3, 11–16 of the PDF; retrieved 2026-10-31; source URLs in `blueprint.json`). The guide says the lists are **non-exhaustive and subject to change**. Use them to keep AI-drafted questions in scope.

**Job tasks out of scope for the candidate:** designing architectures (distributed systems, microservices, database schemas/modeling) · designing and creating CI/CD pipelines · administering IAM users and groups · administering servers and operating systems · selecting foundation models, engineering AI prompts, designing RAG architectures · designing AI safety frameworks, implementing guardrails and AI governance · designing/creating ETL pipelines · designing AWS networking infrastructure.

**Note:** the exam uses official **short names** for services (e.g. "Amazon SNS"); some abbreviations are never expanded (Amazon API Gateway, Amazon EMR).

## In scope

- **Analytics:** Amazon Athena, Amazon Data Firehose, Amazon Kinesis, Amazon OpenSearch Service
- **Application Integration:** Amazon EventBridge, Amazon SNS, Amazon SQS, AWS Step Functions
- **Compute:** Amazon EC2, AWS Elastic Beanstalk, AWS Lambda
- **Containers:** Amazon ECR, Amazon ECS, Amazon EKS
- **Database:** Amazon Aurora, Amazon DynamoDB, Amazon ElastiCache, Amazon RDS
- **Developer Tools:** AWS Amplify, AWS CloudShell, AWS CodeArtifact, AWS CodeBuild, AWS CodeDeploy, AWS CodePipeline, AWS X-Ray
- **Machine Learning and AI:** Amazon Bedrock, Amazon Bedrock AgentCore, Amazon Quick, Kiro
- **Management and Governance:** AWS AppConfig, AWS CDK, AWS CloudFormation, AWS CloudTrail, Amazon CloudWatch, Amazon CloudWatch Logs, AWS CLI, AWS SAM, AWS Systems Manager
- **Networking and Content Delivery:** Amazon API Gateway, Amazon CloudFront, Elastic Load Balancing (ELB), AWS PrivateLink, Amazon Route 53, Amazon VPC
- **Security, Identity, and Compliance:** AWS Certificate Manager (ACM), Amazon Cognito, AWS IAM, AWS KMS, AWS Private CA, AWS Secrets Manager, AWS STS, AWS WAF
- **Storage:** Amazon EBS, Amazon EFS, Amazon S3, Amazon S3 Glacier

## Out of scope (as printed)

- **Analytics:** Amazon QuickSight
- **Business Applications:** Amazon Connect, Amazon WorkMail
- **End User Computing:** Amazon AppStream 2.0, Amazon WorkSpaces
- **Game Tech:** Amazon GameLift
- **Machine Learning and AI:** Amazon Polly, Amazon Rekognition, Amazon SageMaker AI, Strands Agents
- **Management and Governance:** AWS Managed Services (AMS)
- **Media:** Amazon Elastic Transcoder
- **Migration and Transfer:** AWS Application Discovery Service, AWS Application Migration Service, AWS Transfer Family
- **Security, Identity, and Compliance:** AWS Shield Advanced, AWS Shield Standard
- **Storage:** AWS Snow Family, AWS Storage Gateway

## Version notes (guide's comparison section)

- Weights: C02 was 32/26/24/18 (Development / Security / Deployment / Troubleshooting & Optimization); C03 is **30/26/22/22** with Domain 3 renamed **Testing and Deployment**.
- **New in C03:** Task 2.3 on security risks of AI services (5 skills); AI-assisted development and managed AI services in Task 1.1; AI tools for testing, CI/CD, error analysis and optimization; presigned URLs; container image building; containerized deployments (ECS, EKS, Fargate).
- **Moved:** unit testing with AWS SAM (to Task 3.2), Lambda performance tuning (to Task 4.3), serialization (to Task 1.1), API Gateway stages/custom domains (to Task 3.1).
- **Consolidated:** DynamoDB into one skill; encryption + sensitive data into one task; testing into one task; fewer observability and optimization skills. Study material written for C02 will not map one-to-one.
