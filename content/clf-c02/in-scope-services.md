# CLF-C02 in-scope / out-of-scope services

Transcribed from Appendix A of the official exam guide (Version 1.0 CLF-C02, retrieved 2026-10-30; source URL in `blueprint.json`). The guide says these lists are **non-exhaustive and subject to change**. Use this to keep AI-drafted questions inside the exam's scope and to detect out-of-scope distractors.

**Job tasks out of scope for the candidate:** coding, cloud architecture design, troubleshooting, implementation, load and performance testing. → Questions should be *identify / recognize / describe / choose*, not *configure / debug / design*.

## In scope

- **Analytics:** Amazon Athena, AWS Data Exchange, Amazon EMR, AWS Glue, Amazon Kinesis, Amazon MSK, Amazon OpenSearch Service, Amazon QuickSight, Amazon Redshift
- **Application Integration:** Amazon EventBridge, Amazon SNS, Amazon SQS, AWS Step Functions
- **Business Applications:** Amazon Connect, Amazon SES
- **Cloud Financial Management:** AWS Billing Conductor, AWS Budgets, AWS Cost and Usage Report, AWS Cost Explorer, AWS Marketplace
- **Compute:** AWS Batch, Amazon EC2, AWS Elastic Beanstalk, Amazon Lightsail, AWS Local Zones, AWS Outposts, AWS Wavelength
- **Containers:** Amazon ECR, Amazon ECS, Amazon EKS
- **Customer Engagement:** AWS Activate for Startups, AWS IQ, AWS Managed Services (AMS), AWS Support
- **Database:** Amazon Aurora, Amazon DynamoDB, Amazon MemoryDB for Redis, Amazon Neptune, Amazon RDS
- **Developer Tools:** AWS AppConfig, AWS CLI, AWS Cloud9, AWS CloudShell, AWS CodeArtifact, AWS CodeBuild, AWS CodeCommit, AWS CodeDeploy, AWS CodePipeline, AWS CodeStar, AWS X-Ray
- **End User Computing:** Amazon AppStream 2.0, Amazon WorkSpaces, Amazon WorkSpaces Web
- **Frontend Web and Mobile:** AWS Amplify, AWS AppSync, AWS Device Farm
- **IoT:** AWS IoT Core, AWS IoT Greengrass
- **Machine Learning:** Amazon Comprehend, Amazon Kendra, Amazon Lex, Amazon Polly, Amazon Rekognition, Amazon SageMaker, Amazon Textract, Amazon Transcribe, Amazon Translate
- **Management and Governance:** AWS Auto Scaling, AWS CloudFormation, AWS CloudTrail, Amazon CloudWatch, AWS Compute Optimizer, AWS Config, AWS Control Tower, AWS Health Dashboard, AWS Launch Wizard, AWS License Manager, AWS Management Console, AWS Organizations, AWS Resource Groups and Tag Editor, AWS Service Catalog, AWS Systems Manager, AWS Trusted Advisor, AWS Well-Architected Tool
- **Migration and Transfer:** AWS Application Discovery Service, AWS Application Migration Service, AWS DMS, AWS Migration Hub, AWS SCT, AWS Snow Family, AWS Transfer Family
- **Networking and Content Delivery:** Amazon API Gateway, Amazon CloudFront, AWS Direct Connect, AWS Global Accelerator, Amazon Route 53, Amazon VPC, AWS VPN
- **Security, Identity, and Compliance:** AWS Artifact, AWS Audit Manager, AWS Certificate Manager, AWS CloudHSM, Amazon Cognito, Amazon Detective, AWS Directory Service, AWS Firewall Manager, Amazon GuardDuty, AWS IAM, AWS IAM Identity Center, Amazon Inspector, AWS KMS, Amazon Macie, AWS Network Firewall, AWS RAM, AWS Secrets Manager, AWS Security Hub, AWS Shield, AWS WAF
- **Serverless:** AWS Fargate, AWS Lambda
- **Storage:** AWS Backup, Amazon EBS, Amazon EFS, AWS Elastic Disaster Recovery, Amazon FSx, Amazon S3, Amazon S3 Glacier, AWS Storage Gateway

## Concepts that might appear (Appendix A)

APIs · benefits of migrating to the AWS Cloud · AWS CAF · AWS Compliance · compute · cost management · databases · EC2 instance types (Reserved, On-Demand, Spot) · AWS global infrastructure (Regions, AZs) · infrastructure as code · AWS Knowledge Center · machine learning · management and governance · migration and data transfer · network services · AWS Partner Network · AWS Prescriptive Guidance · AWS Pricing Calculator · AWS Professional Services · AWS re:Post · AWS SDKs · security · AWS Security Blog · AWS Security Center · shared responsibility model · AWS Solutions Architects · storage · AWS Support Center · AWS Support plans · AWS Well-Architected Framework

## Out of scope (examples from the guide)

- **Game Tech:** Amazon GameLift, Amazon Lumberyard
- **Media Services:** AWS Elemental Appliances and Software, MediaConnect, MediaConvert, MediaLive, MediaPackage, MediaStore, MediaTailor, Amazon IVS
- **Robotics:** AWS RoboMaker

(This is the complete out-of-scope list as printed in the guide — Appendix B starts on the next page. The guide still calls it non-exhaustive, so treat any service not in the in-scope list as suspect and check before drafting a question about it.)

## Version note

Appendix B of the guide says CLF-C02 has been in use since 2023-09-19 and replaced CLF-C01 (retired 2023-09-18). Domain weights: C01 was 26/25/33/16; C02 is 24/30/34/12. Study material written for C01 under-weights Security and Compliance and over-weights Billing — a reason to re-verify any imported third-party question's domain tag.
