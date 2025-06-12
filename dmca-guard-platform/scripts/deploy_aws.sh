
#!/bin/bash

# DMCA Guard Platform - Deploy AWS
# Script para deploy automatizado na AWS usando ECS/Fargate

set -e

echo "☁️ DMCA Guard Platform - Deploy AWS"
echo "==================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Configurações padrão
AWS_REGION="us-east-1"
CLUSTER_NAME="dmca-guard-cluster"
SERVICE_NAME="dmca-guard-service"
TASK_FAMILY="dmca-guard-task"
ECR_REPOSITORY="dmca-guard-app"
VPC_NAME="dmca-guard-vpc"

# Verificar pré-requisitos
check_prerequisites() {
    log_info "Verificando pré-requisitos..."
    
    # AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI não encontrado. Instale: https://aws.amazon.com/cli/"
        exit 1
    fi
    
    # Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker não encontrado. Instale: https://docker.com"
        exit 1
    fi
    
    # Terraform (opcional)
    if ! command -v terraform &> /dev/null; then
        log_warning "Terraform não encontrado. Usando AWS CLI para infraestrutura."
        USE_TERRAFORM=false
    else
        USE_TERRAFORM=true
    fi
    
    # jq para parsing JSON
    if ! command -v jq &> /dev/null; then
        log_error "jq não encontrado. Instale: sudo apt install jq"
        exit 1
    fi
    
    log_success "Pré-requisitos verificados"
}

# Configurar credenciais AWS
setup_aws_credentials() {
    log_info "Verificando credenciais AWS..."
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "Credenciais AWS não configuradas"
        echo "Configure com: aws configure"
        exit 1
    fi
    
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    log_success "AWS Account ID: $AWS_ACCOUNT_ID"
    
    # Verificar região
    read -p "Região AWS [$AWS_REGION]: " input_region
    AWS_REGION=${input_region:-$AWS_REGION}
    
    export AWS_DEFAULT_REGION=$AWS_REGION
    log_success "Região configurada: $AWS_REGION"
}

# Criar infraestrutura com Terraform
create_infrastructure_terraform() {
    log_info "Criando infraestrutura com Terraform..."
    
    # Criar diretório de infraestrutura se não existir
    mkdir -p infrastructure
    
    # Criar arquivo main.tf
    cat > infrastructure/main.tf << 'EOF'
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "dmca-guard"
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# Subnets públicas
resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-${count.index + 1}"
  }
}

# Subnets privadas
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "${var.project_name}-private-${count.index + 1}"
  }
}

# Route table para subnets públicas
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

# Associar route table com subnets públicas
resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Security Group para ALB
resource "aws_security_group" "alb" {
  name_prefix = "${var.project_name}-alb-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-alb-sg"
  }
}

# Security Group para ECS
resource "aws_security_group" "ecs" {
  name_prefix = "${var.project_name}-ecs-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-ecs-sg"
  }
}

# Security Group para RDS
resource "aws_security_group" "rds" {
  name_prefix = "${var.project_name}-rds-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  tags = {
    Name = "${var.project_name}-rds-sg"
  }
}

# RDS Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-db"
  
  engine         = "postgres"
  engine_version = "14.9"
  instance_class = "db.t3.micro"
  
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp2"
  storage_encrypted     = true
  
  db_name  = "dmca_guard"
  username = "dmca_user"
  password = random_password.db_password.result
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  skip_final_snapshot = false
  final_snapshot_identifier = "${var.project_name}-final-snapshot"
  
  tags = {
    Name = "${var.project_name}-database"
  }
}

# Random password para RDS
resource "random_password" "db_password" {
  length  = 16
  special = true
}

# ECR Repository
resource "aws_ecr_repository" "main" {
  name                 = var.project_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets           = aws_subnet.public[*].id

  enable_deletion_protection = false

  tags = {
    Name = "${var.project_name}-alb"
  }
}

# ALB Target Group
resource "aws_lb_target_group" "main" {
  name        = "${var.project_name}-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }
}

# ALB Listener
resource "aws_lb_listener" "main" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main.arn
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

# Outputs
output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.main.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "database_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "database_password" {
  value     = random_password.db_password.result
  sensitive = true
}
EOF

    # Executar Terraform
    cd infrastructure
    terraform init
    terraform plan -var="aws_region=$AWS_REGION"
    
    read -p "Aplicar infraestrutura? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        terraform apply -var="aws_region=$AWS_REGION" -auto-approve
        
        # Obter outputs
        ECR_URI=$(terraform output -raw ecr_repository_url)
        ALB_DNS=$(terraform output -raw alb_dns_name)
        DB_ENDPOINT=$(terraform output -raw database_endpoint)
        DB_PASSWORD=$(terraform output -raw database_password)
        
        log_success "Infraestrutura criada com Terraform"
    else
        log_error "Deploy cancelado"
        exit 1
    fi
    
    cd ..
}

# Criar infraestrutura com AWS CLI
create_infrastructure_cli() {
    log_info "Criando infraestrutura com AWS CLI..."
    
    # Criar VPC
    VPC_ID=$(aws ec2 create-vpc \
        --cidr-block 10.0.0.0/16 \
        --query 'Vpc.VpcId' \
        --output text)
    
    aws ec2 create-tags \
        --resources $VPC_ID \
        --tags Key=Name,Value=$VPC_NAME
    
    log_success "VPC criada: $VPC_ID"
    
    # Criar ECR Repository
    ECR_URI=$(aws ecr create-repository \
        --repository-name $ECR_REPOSITORY \
        --query 'repository.repositoryUri' \
        --output text 2>/dev/null || \
        aws ecr describe-repositories \
        --repository-names $ECR_REPOSITORY \
        --query 'repositories[0].repositoryUri' \
        --output text)
    
    log_success "ECR Repository: $ECR_URI"
    
    # Criar ECS Cluster
    aws ecs create-cluster --cluster-name $CLUSTER_NAME > /dev/null
    log_success "ECS Cluster criado: $CLUSTER_NAME"
}

# Build e push da imagem Docker
build_and_push_image() {
    log_info "Fazendo build e push da imagem Docker..."
    
    # Login no ECR
    aws ecr get-login-password --region $AWS_REGION | \
        docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
    
    # Build da imagem
    log_info "Fazendo build da imagem..."
    docker build -f Dockerfile.production -t $ECR_REPOSITORY:latest app/
    
    # Tag da imagem
    docker tag $ECR_REPOSITORY:latest $ECR_URI:latest
    
    # Push da imagem
    log_info "Fazendo push da imagem..."
    docker push $ECR_URI:latest
    
    log_success "Imagem enviada para ECR"
}

# Criar Dockerfile otimizado para produção
create_production_dockerfile() {
    log_info "Criando Dockerfile de produção..."
    
    cat > app/Dockerfile.production << 'EOF'
# Multi-stage build para otimizar tamanho da imagem
FROM node:18-alpine AS base

# Instalar dependências apenas quando necessário
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copiar arquivos de dependências
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild apenas quando necessário
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Gerar cliente Prisma
RUN npx prisma generate

# Build da aplicação
ENV NEXT_TELEMETRY_DISABLED 1
RUN yarn build

# Imagem de produção
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar arquivos necessários
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copiar Prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
EOF
    
    log_success "Dockerfile de produção criado"
}

# Configurar variáveis de ambiente
setup_environment() {
    log_info "Configurando variáveis de ambiente..."
    
    # Solicitar informações necessárias
    echo "Por favor, forneça as seguintes informações:"
    
    read -p "OpenAI API Key: " OPENAI_API_KEY
    read -p "SendGrid API Key: " SENDGRID_API_KEY
    read -p "SendGrid From Email: " SENDGRID_FROM_EMAIL
    read -p "NextAuth Secret (deixe vazio para gerar): " NEXTAUTH_SECRET
    
    if [ -z "$NEXTAUTH_SECRET" ]; then
        NEXTAUTH_SECRET=$(openssl rand -base64 32)
    fi
    
    # Construir DATABASE_URL
    if [ ! -z "$DB_ENDPOINT" ]; then
        DATABASE_URL="postgresql://dmca_user:$DB_PASSWORD@$DB_ENDPOINT:5432/dmca_guard"
    else
        read -p "Database URL: " DATABASE_URL
    fi
    
    # Criar arquivo de variáveis para ECS
    cat > aws-env-vars.json << EOF
[
  {
    "name": "NODE_ENV",
    "value": "production"
  },
  {
    "name": "DATABASE_URL",
    "value": "$DATABASE_URL"
  },
  {
    "name": "NEXTAUTH_SECRET",
    "value": "$NEXTAUTH_SECRET"
  },
  {
    "name": "NEXTAUTH_URL",
    "value": "http://$ALB_DNS"
  },
  {
    "name": "OPENAI_API_KEY",
    "value": "$OPENAI_API_KEY"
  },
  {
    "name": "SENDGRID_API_KEY",
    "value": "$SENDGRID_API_KEY"
  },
  {
    "name": "SENDGRID_FROM_EMAIL",
    "value": "$SENDGRID_FROM_EMAIL"
  },
  {
    "name": "APP_URL",
    "value": "http://$ALB_DNS"
  },
  {
    "name": "APP_NAME",
    "value": "DMCA Guard"
  }
]
EOF
    
    log_success "Variáveis de ambiente configuradas"
}

# Criar task definition do ECS
create_task_definition() {
    log_info "Criando task definition do ECS..."
    
    cat > task-definition.json << EOF
{
  "family": "$TASK_FAMILY",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "dmca-guard-app",
      "image": "$ECR_URI:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": $(cat aws-env-vars.json),
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/dmca-guard",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "curl -f http://localhost:3000/api/health || exit 1"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF
    
    log_success "Task definition criada"
}

# Criar IAM roles necessárias
create_iam_roles() {
    log_info "Criando IAM roles..."
    
    # ECS Task Execution Role
    aws iam create-role \
        --role-name ecsTaskExecutionRole \
        --assume-role-policy-document '{
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "ecs-tasks.amazonaws.com"
                    },
                    "Action": "sts:AssumeRole"
                }
            ]
        }' > /dev/null 2>&1 || true
    
    aws iam attach-role-policy \
        --role-name ecsTaskExecutionRole \
        --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy > /dev/null 2>&1 || true
    
    # ECS Task Role
    aws iam create-role \
        --role-name ecsTaskRole \
        --assume-role-policy-document '{
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "ecs-tasks.amazonaws.com"
                    },
                    "Action": "sts:AssumeRole"
                }
            ]
        }' > /dev/null 2>&1 || true
    
    log_success "IAM roles criadas"
}

# Criar CloudWatch Log Group
create_log_group() {
    log_info "Criando CloudWatch Log Group..."
    
    aws logs create-log-group \
        --log-group-name /ecs/dmca-guard \
        --region $AWS_REGION > /dev/null 2>&1 || true
    
    log_success "Log group criado"
}

# Registrar task definition
register_task_definition() {
    log_info "Registrando task definition..."
    
    TASK_DEFINITION_ARN=$(aws ecs register-task-definition \
        --cli-input-json file://task-definition.json \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)
    
    log_success "Task definition registrada: $TASK_DEFINITION_ARN"
}

# Criar serviço ECS
create_ecs_service() {
    log_info "Criando serviço ECS..."
    
    # Obter subnet IDs (simplificado para CLI)
    SUBNET_IDS=$(aws ec2 describe-subnets \
        --filters "Name=vpc-id,Values=$VPC_ID" \
        --query 'Subnets[0:2].SubnetId' \
        --output text | tr '\t' ',')
    
    # Criar security group básico
    SG_ID=$(aws ec2 create-security-group \
        --group-name dmca-guard-ecs-sg \
        --description "Security group for DMCA Guard ECS" \
        --vpc-id $VPC_ID \
        --query 'GroupId' \
        --output text 2>/dev/null || \
        aws ec2 describe-security-groups \
        --filters "Name=group-name,Values=dmca-guard-ecs-sg" \
        --query 'SecurityGroups[0].GroupId' \
        --output text)
    
    # Permitir tráfego na porta 3000
    aws ec2 authorize-security-group-ingress \
        --group-id $SG_ID \
        --protocol tcp \
        --port 3000 \
        --cidr 0.0.0.0/0 > /dev/null 2>&1 || true
    
    # Criar serviço
    aws ecs create-service \
        --cluster $CLUSTER_NAME \
        --service-name $SERVICE_NAME \
        --task-definition $TASK_FAMILY \
        --desired-count 1 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" > /dev/null
    
    log_success "Serviço ECS criado"
}

# Executar migrações do banco
run_migrations() {
    log_info "Executando migrações do banco..."
    
    # Aguardar serviço ficar estável
    log_info "Aguardando serviço ficar estável..."
    aws ecs wait services-stable \
        --cluster $CLUSTER_NAME \
        --services $SERVICE_NAME
    
    # Executar task para migrações
    TASK_ARN=$(aws ecs run-task \
        --cluster $CLUSTER_NAME \
        --task-definition $TASK_FAMILY \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
        --overrides '{
            "containerOverrides": [
                {
                    "name": "dmca-guard-app",
                    "command": ["npx", "prisma", "migrate", "deploy"]
                }
            ]
        }' \
        --query 'tasks[0].taskArn' \
        --output text)
    
    # Aguardar task completar
    aws ecs wait tasks-stopped \
        --cluster $CLUSTER_NAME \
        --tasks $TASK_ARN
    
    log_success "Migrações executadas"
}

# Verificar deploy
verify_deployment() {
    log_info "Verificando deploy..."
    
    # Obter IP público da task
    TASK_ARN=$(aws ecs list-tasks \
        --cluster $CLUSTER_NAME \
        --service-name $SERVICE_NAME \
        --query 'taskArns[0]' \
        --output text)
    
    if [ "$TASK_ARN" != "None" ]; then
        ENI_ID=$(aws ecs describe-tasks \
            --cluster $CLUSTER_NAME \
            --tasks $TASK_ARN \
            --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' \
            --output text)
        
        PUBLIC_IP=$(aws ec2 describe-network-interfaces \
            --network-interface-ids $ENI_ID \
            --query 'NetworkInterfaces[0].Association.PublicIp' \
            --output text)
        
        if [ "$PUBLIC_IP" != "None" ]; then
            APP_URL="http://$PUBLIC_IP:3000"
            log_info "Testando aplicação em: $APP_URL"
            
            # Aguardar aplicação ficar disponível
            for i in {1..30}; do
                if curl -f "$APP_URL/api/health" > /dev/null 2>&1; then
                    log_success "Aplicação está respondendo!"
                    break
                else
                    log_info "Aguardando aplicação... ($i/30)"
                    sleep 10
                fi
            done
            
            if curl -f "$APP_URL/api/health" > /dev/null 2>&1; then
                log_success "Deploy verificado com sucesso!"
                echo "🎉 Aplicação disponível em: $APP_URL"
            else
                log_error "Aplicação não está respondendo"
            fi
        fi
    fi
}

# Configurar monitoramento
setup_monitoring() {
    log_info "Configurando monitoramento básico..."
    
    # CloudWatch já está configurado via logs
    log_success "Monitoramento básico configurado"
    log_warning "Configure alertas adicionais no CloudWatch"
}

# Mostrar informações finais
show_final_info() {
    echo
    echo "🎉 Deploy na AWS concluído!"
    echo "=========================="
    echo
    echo "📋 Recursos Criados:"
    echo "• ECS Cluster: $CLUSTER_NAME"
    echo "• ECS Service: $SERVICE_NAME"
    echo "• ECR Repository: $ECR_URI"
    echo "• VPC: $VPC_ID"
    echo
    echo "🔧 Comandos Úteis:"
    echo "• Ver logs: aws logs tail /ecs/dmca-guard --follow"
    echo "• Status do serviço: aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME"
    echo "• Listar tasks: aws ecs list-tasks --cluster $CLUSTER_NAME"
    echo "• Redeploy: aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --force-new-deployment"
    echo
    echo "📚 Próximos Passos:"
    echo "1. Configure Application Load Balancer"
    echo "2. Configure domínio customizado"
    echo "3. Configure SSL/TLS"
    echo "4. Configure auto-scaling"
    echo "5. Configure backup automático"
    echo
    echo "💰 Custos Estimados (por mês):"
    echo "• ECS Fargate: ~\$15-30"
    echo "• RDS t3.micro: ~\$15-20"
    echo "• ALB: ~\$20-25"
    echo "• Total: ~\$50-75"
    echo
    echo "🆘 Suporte:"
    echo "• Documentação: docs/deploy.md"
    echo "• AWS Docs: https://docs.aws.amazon.com/ecs/"
    echo "• Suporte: suporte@dmcaguard.com"
}

# Função principal
main() {
    check_prerequisites
    setup_aws_credentials
    
    if [[ "$USE_TERRAFORM" == true ]]; then
        create_infrastructure_terraform
    else
        create_infrastructure_cli
    fi
    
    create_production_dockerfile
    build_and_push_image
    setup_environment
    create_iam_roles
    create_log_group
    create_task_definition
    register_task_definition
    create_ecs_service
    run_migrations
    verify_deployment
    setup_monitoring
    show_final_info
}

# Executar deploy
main "$@"
