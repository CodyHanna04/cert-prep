# SAA-C03 in-scope / out-of-scope services

Transcribed from the official exam guide, **SAA-C03 version 1.1 (October 29, 2026)**, HTML guide and sub-pages, retrieved 2026-11-10 (source URLs in `blueprint.json`). The guide says the lists are **non-exhaustive and subject to change**. Use them to keep AI-drafted questions in scope.

**Target candidate:** at least 1 year of hands-on experience designing cloud solutions that use AWS services. The guide validates designing solutions based on the AWS Well-Architected Framework: designing for current and future needs, designing secure, resilient, high-performing and cost-optimized architectures, and reviewing existing solutions to determine improvements. Unlike the DVA-C03 guide, it lists no out-of-scope job tasks.

**Note:** use the exam's short names for services (for example "Amazon SNS"). Some abbreviations are never expanded (Amazon API Gateway, Amazon EMR).

## In scope

- **Analytics:** Amazon Athena, AWS Data Exchange, AWS Data Pipeline, Amazon EMR, AWS Glue, Amazon Kinesis, AWS Lake Formation, Amazon Managed Streaming for Apache Kafka (Amazon MSK), Amazon OpenSearch Service, Amazon Quick, Amazon Redshift
- **Application Integration:** Amazon AppFlow, Amazon EventBridge, Amazon MQ, Amazon SNS, Amazon SQS, AWS Step Functions
- **AWS Cost Management:** AWS Budgets, AWS Cost and Usage Report, AWS Cost Explorer, Savings Plans
- **Compute:** AWS Batch, Amazon EC2, Amazon EC2 Auto Scaling, AWS Elastic Beanstalk, AWS Outposts, AWS Serverless Application Repository, VMware Cloud on AWS, AWS Wavelength
- **Containers:** Amazon ECR, Amazon ECS, Amazon ECS Anywhere, Amazon EKS, Amazon EKS Anywhere, Amazon EKS Distro
- **Database:** Amazon Aurora, Amazon Aurora Serverless, Amazon DocumentDB, Amazon DynamoDB, Amazon ElastiCache, Amazon Keyspaces, Amazon Neptune, Amazon RDS, Amazon Redshift
- **Developer Tools:** AWS X-Ray
- **Front-End Web and Mobile:** AWS Amplify, Amazon API Gateway, AWS Device Farm
- **Machine Learning:** Amazon Comprehend, Amazon Lex, Amazon Polly, Amazon Rekognition, Amazon SageMaker AI, Amazon Textract, Amazon Transcribe, Amazon Translate
- **Management and Governance:** AWS Auto Scaling, AWS CLI, AWS CloudFormation, AWS CloudTrail, Amazon CloudWatch, AWS Compute Optimizer, AWS Config, AWS Control Tower, AWS Health Dashboard, AWS License Manager, Amazon Managed Grafana, Amazon Managed Service for Prometheus, AWS Management Console, AWS Organizations, AWS Proton, AWS Service Catalog, AWS Systems Manager, AWS Well-Architected Tool
- **Media Services:** Amazon Kinesis Video Streams
- **Migration and Transfer:** AWS Application Discovery Service, AWS Application Migration Service, AWS DataSync, AWS DMS, AWS Snow Family, AWS Transfer Family
- **Networking and Content Delivery:** AWS Client VPN, Amazon CloudFront, AWS Direct Connect, Elastic Load Balancing (ELB), AWS Global Accelerator, AWS PrivateLink, Amazon Route 53, AWS Site-to-Site VPN, AWS Transit Gateway, Amazon VPC
- **Security, Identity, and Compliance:** AWS Artifact, AWS Certificate Manager (ACM), AWS CloudHSM, Amazon Cognito, Amazon Detective, AWS Directory Service, AWS Firewall Manager, Amazon GuardDuty, AWS IAM Identity Center, Amazon Inspector, AWS KMS, Amazon Macie, AWS Network Firewall, AWS Resource Access Manager (AWS RAM), AWS Secrets Manager, AWS Security Hub, AWS Shield, AWS WAF, IAM
- **Serverless:** AWS Fargate, AWS Lambda
- **Storage:** AWS Backup, Amazon EBS, Amazon EFS, Amazon FSx (for all types), Amazon S3, Amazon S3 Glacier, AWS Storage Gateway

## Out of scope (as printed)

- **Application Integration:** Amazon Managed Workflows for Apache Airflow (Amazon MWAA)
- **Compute:** Amazon Lightsail
- **Database:** Amazon RDS on VMware
- **Developer Tools:** AWS CDK, AWS CloudShell, AWS CodeArtifact, AWS CodeBuild, AWS CodeCommit, AWS CodeDeploy, Amazon Corretto, AWS Fault Injection Simulator (AWS FIS), AWS Tools and SDKs
- **Front-End Web and Mobile:** Amazon Location Service
- **Game Tech:** Amazon GameLift
- **Internet of Things:** all services
- **Machine Learning:** Apache MXNet on AWS, AWS Deep Learning AMIs (DLAMI), AWS Deep Learning Containers, Amazon HealthLake, AWS Inferentia, Amazon Personalize, PyTorch on AWS, TensorFlow on AWS
- **Management and Governance:** AWS Console Mobile Application, AWS Distro for OpenTelemetry
- **Media Services:** AWS Elemental Appliances and Software, AWS Elemental MediaConnect, AWS Elemental MediaConvert, AWS Elemental MediaLive, AWS Elemental MediaPackage, AWS Elemental MediaTailor, Amazon Interactive Video Service (Amazon IVS)
- **Migration and Transfer:** Migration Evaluator
- **Networking and Content Delivery:** AWS Cloud Map
- **Quantum Technologies:** Amazon Braket
- **Satellite:** AWS Ground Station

## Technologies and concepts (as printed)

Compute; cost management; database; disaster recovery; high performance; management and governance; microservices and component delivery; migration and data transfer; networking, connectivity, and content delivery; resiliency; security; serverless and event-driven design principles; storage.

## Version notes

- **Revisions page:** 1.0 (August 28, 2026) and 1.1 (October 29, 2026). AWS says guide updates reach the exam about a month after publication.
- **Removed from the lists (no version given):** Amazon Elastic Transcoder from in-scope. AWS DeepComposer, Amazon DevOps Guru, Amazon Elastic Inference, Amazon Managed Blockchain and Amazon Sumerian from out-of-scope (retired services). The lint blocks all of them, plus the old name QuickSight (now Amazon Quick).
- **Lint gaps:** the lint matches exact terms, so it does not catch "Internet of Things: all services" beyond "AWS IoT", or "AWS Tools and SDKs". Review drafts for these by hand.
- **No successor announced** on the certification page or in the guide (checked 2026-11-10).
