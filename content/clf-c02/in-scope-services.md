# CLF-C02 in-scope / out-of-scope services

Transcribed from the official exam guide, **Version 1.3 (October 29, 2026)**, HTML edition and its sub-pages, retrieved 2026-11-08 (source URL in `blueprint.json`). AWS revises CLF-C02 in place (1.0 June 2026, 1.1 August, 1.2 September, 1.3 October) and publishes each update about a month before it reaches the exam. The guide says these lists are **non-exhaustive and subject to change**. Re-check the revisions page before a content pass.

An earlier version of this file came from an older CLF-C02 PDF. That PDF used retired names and support plans (Amazon SageMaker, Amazon QuickSight, the Developer, Business and Enterprise On-Ramp plans) and listed services that are now out of scope or gone (Billing Conductor, AWS Activate, AWS IQ, AMS, Wavelength, Local Zones, Snow Family, Kendra, Audit Manager, Cloud9, CodeCommit). Use this version.

**Job tasks out of scope for the candidate:** coding, designing cloud architecture, troubleshooting, implementation, load and performance testing. → Questions should be *identify / recognize / describe / choose*, not *configure / debug / design*. Target candidate: up to 6 months of exposure to AWS.

**Support plans the guide names (Task 4.3):** customer service and communities, Basic Support, AWS Business Support+, AWS Enterprise Support, AWS Unified Operations.

## In scope

- **Analytics:** Amazon Athena, Amazon EMR, AWS Glue, Amazon Kinesis, Amazon OpenSearch Service, Amazon Quick, Amazon Redshift
- **Application Integration:** Amazon EventBridge, Amazon SNS, Amazon SQS, AWS Step Functions
- **Business Applications:** Amazon Connect, Amazon SES
- **Cloud Financial Management:** AWS Budgets, AWS Cost and Usage Reports, AWS Cost Explorer, AWS Marketplace
- **Compute:** AWS Batch, Amazon EC2, AWS Elastic Beanstalk, Amazon Lightsail, AWS Outposts
- **Containers:** Amazon ECR, Amazon ECS, Amazon EKS
- **Customer Enablement:** AWS Support
- **Database:** Amazon Aurora, Amazon DocumentDB, Amazon DynamoDB, Amazon ElastiCache, Amazon Neptune, Amazon RDS
- **Developer Tools:** AWS CLI, AWS CodeBuild, AWS CodePipeline, AWS X-Ray
- **End User Computing:** Amazon AppStream 2.0, Amazon WorkSpaces, Amazon WorkSpaces Secure Browser
- **Frontend Web and Mobile:** AWS Amplify
- **Internet of Things:** AWS IoT Core
- **Machine Learning:** Amazon Comprehend, Amazon Lex, Amazon Polly, Amazon Q, Amazon Rekognition, Amazon SageMaker AI, Amazon Textract, Amazon Transcribe, Amazon Translate
- **Management and Governance:** AWS Auto Scaling, AWS CloudFormation, AWS CloudTrail, Amazon CloudWatch, AWS Compute Optimizer, AWS Config, AWS Control Tower, AWS Health Dashboard, AWS License Manager, AWS Management Console, AWS Organizations, AWS Service Catalog, Service Quotas, AWS Systems Manager, AWS Trusted Advisor, AWS Well-Architected Tool
- **Migration and Transfer:** AWS Application Discovery Service, AWS Application Migration Service, AWS DMS, Migration Evaluator, AWS Migration Hub, AWS SCT
- **Networking and Content Delivery:** Amazon API Gateway, Amazon CloudFront, AWS Direct Connect, AWS Global Accelerator, AWS PrivateLink, Amazon Route 53, AWS Transit Gateway, Amazon VPC, AWS VPN, AWS Site-to-Site VPN, AWS Client VPN
- **Security, Identity, and Compliance:** AWS Artifact, AWS Certificate Manager (ACM), AWS CloudHSM, Amazon Cognito, Amazon Detective, AWS Directory Service, AWS Firewall Manager, Amazon GuardDuty, AWS IAM, AWS IAM Identity Center, Amazon Inspector, AWS KMS, Amazon Macie, AWS RAM, AWS Secrets Manager, AWS Security Hub, AWS Shield, AWS WAF
- **Serverless:** AWS Fargate, AWS Lambda
- **Storage:** AWS Backup, Amazon EBS, Amazon EFS, AWS Elastic Disaster Recovery, Amazon FSx, Amazon S3, Amazon S3 Glacier, AWS Storage Gateway

## Technologies and concepts that might appear

APIs · benefits of migrating to the AWS Cloud · AWS CAF · AWS Compliance · compute · cost management · databases · EC2 instance types (Reserved, On-Demand, Spot) · AWS global infrastructure (Regions, Availability Zones) · infrastructure as code · AWS Knowledge Center · machine learning · management and governance · migration and data transfer · network services · AWS Partner Network · AWS Prescriptive Guidance · AWS Pricing Calculator · AWS Professional Services · AWS re:Post · AWS SDKs · security · AWS Security Blog · shared responsibility model · AWS solutions architects · storage · AWS Support Center · AWS Support plans · AWS Well-Architected Framework

## Out of scope (as printed)

- **Analytics:** Amazon AppFlow, AWS Clean Rooms, AWS Data Exchange, Amazon DataZone, Amazon MSK
- **Application Integration:** AWS AppFabric, Amazon Simple Workflow Service
- **Compute:** AWS Copilot, AWS Wavelength
- **Cost Management:** AWS Application Cost Profiler, Amazon DevPay
- **Customer Enablement:** AWS Activate, AWS IQ, Amazon Managed Services (AMS)
- **Cloud Financial Management:** AWS Billing Conductor
- **Database:** Amazon Keyspaces, Amazon MemoryDB, AWS AppConfig
- **Developer Tools:** AWS Application Composer, AWS CodeArtifact, AWS CodeDeploy, Amazon CodeGuru, AWS CloudShell, AWS Device Farm
- **Game Tech:** Amazon GameLift
- **IoT:** AWS IoT Device Defender, AWS IoT Greengrass
- **Machine Learning:** Amazon Fraud Detector, Amazon Personalize
- **Management and Governance:** AWS Chatbot, Amazon Data Lifecycle Manager, AWS Launch Wizard
- **Media Services:** AWS Elemental appliances and services (MediaConnect, MediaConvert, MediaLive, MediaPackage, MediaTailor), Amazon IVS
- **Migration and Transfer:** AWS Migration Hub Refactor Spaces, AWS Transfer Family
- **Networking and Content Delivery:** AWS Cloud Map, AWS Network Access Analyzer, AWS Ground Station, Amazon VPC Lattice
- **Security, Identity, and Compliance:** Amazon Cloud Directory, AWS Network Firewall
- **Storage:** Amazon FSx for Lustre

Services that appear on neither list (for example Amazon Kendra, AWS Local Zones, the Snow Family, AWS DataSync, AWS Audit Manager) are suspect: leave them out of questions, distractors included.

**Beyond the printed list:**
- **Amazon Bedrock** is not on the printed in-scope list. The learner saw it, alongside SageMaker, as an answer choice on the real CLF-C02 exam, so it can appear (the list is non-exhaustive).
- **Depth:** use it at recognition level only. Bedrock builds generative AI applications on foundation models through an API, while SageMaker AI builds, trains and deploys your own models. Keep deeper generative-AI concepts (RAG, fine-tuning, prompt technique) out.

The lint's `outOfScopeTerms` covers the out-of-scope list above, plus retired names, retired plans, and services on neither list that are known to be gone (Kendra, Local Zones, Snow Family, DataSync, Audit Manager), so they can't drift back in.
