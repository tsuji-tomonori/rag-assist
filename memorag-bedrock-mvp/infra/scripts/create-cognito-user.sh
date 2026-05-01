#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="MemoRagMvpStack"
USER_POOL_ID="${COGNITO_USER_POOL_ID:-}"
EMAIL=""
NAME=""
PASSWORD=""
TEMPORARY_PASSWORD=""
PERMANENT_PASSWORD="false"
SUPPRESS_INVITE="false"
AWS_REGION_ARG=()
AWS_PROFILE_ARG=()
ROLES=()

usage() {
  cat <<'USAGE'
Usage:
  infra/scripts/create-cognito-user.sh --email user@example.com [options]

Options:
  --email EMAIL                 Cognito user email address. Also used as username.
  --user-pool-id USER_POOL_ID   Cognito User Pool ID. Defaults to COGNITO_USER_POOL_ID.
  --stack-name STACK_NAME       CloudFormation stack name used to resolve CognitoUserPoolId.
                                Defaults to MemoRagMvpStack.
  --role ROLE                   Cognito group to assign. Repeatable. Defaults to CHAT_USER.
                                Groups are created by the CDK stack.
                                Valid roles: CHAT_USER, ANSWER_EDITOR, RAG_GROUP_MANAGER,
                                USER_ADMIN, ACCESS_ADMIN, COST_AUDITOR, SYSTEM_ADMIN.
  --name NAME                   Optional Cognito name attribute.
  --temporary-password VALUE    Temporary password for the new user.
  --password VALUE              Set a permanent password after creating/finding the user.
  --permanent-password          Treat --temporary-password as permanent after user creation.
                                This also suppresses the Cognito invitation email.
  --suppress-invite             Suppress Cognito invitation email on new user creation.
  --region REGION              AWS region for AWS CLI calls.
  --profile PROFILE            AWS CLI profile.
  -h, --help                    Show this help.

Examples:
  infra/scripts/create-cognito-user.sh --email alice@example.com --role SYSTEM_ADMIN

  infra/scripts/create-cognito-user.sh \
    --email alice@example.com \
    --password 'ExamplePassw0rd!' \
    --role CHAT_USER \
    --suppress-invite
USAGE
}

die() {
  echo "error: $*" >&2
  exit 1
}

is_valid_role() {
  case "$1" in
    CHAT_USER | ANSWER_EDITOR | RAG_GROUP_MANAGER | USER_ADMIN | ACCESS_ADMIN | COST_AUDITOR | SYSTEM_ADMIN) return 0 ;;
    *) return 1 ;;
  esac
}

aws_cli() {
  aws "${AWS_REGION_ARG[@]}" "${AWS_PROFILE_ARG[@]}" "$@"
}

resolve_user_pool_id() {
  if [[ -n "$USER_POOL_ID" ]]; then
    return
  fi

  USER_POOL_ID="$(
    aws_cli cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolId'].OutputValue | [0]" \
      --output text
  )"

  if [[ -z "$USER_POOL_ID" || "$USER_POOL_ID" == "None" ]]; then
    die "CognitoUserPoolId was not found in stack output. Pass --user-pool-id or set COGNITO_USER_POOL_ID."
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)
      EMAIL="${2:-}"
      shift 2
      ;;
    --user-pool-id)
      USER_POOL_ID="${2:-}"
      shift 2
      ;;
    --stack-name)
      STACK_NAME="${2:-}"
      shift 2
      ;;
    --role)
      ROLES+=("${2:-}")
      shift 2
      ;;
    --name)
      NAME="${2:-}"
      shift 2
      ;;
    --temporary-password)
      TEMPORARY_PASSWORD="${2:-}"
      shift 2
      ;;
    --password)
      PASSWORD="${2:-}"
      shift 2
      ;;
    --permanent-password)
      PERMANENT_PASSWORD="true"
      shift
      ;;
    --suppress-invite)
      SUPPRESS_INVITE="true"
      shift
      ;;
    --region)
      AWS_REGION_ARG=(--region "${2:-}")
      shift 2
      ;;
    --profile)
      AWS_PROFILE_ARG=(--profile "${2:-}")
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

command -v aws >/dev/null 2>&1 || die "aws CLI is required."
[[ -n "$EMAIL" ]] || die "--email is required."
[[ "$EMAIL" == *@* ]] || die "--email must look like an email address."

if [[ ${#ROLES[@]} -eq 0 ]]; then
  ROLES=(CHAT_USER)
fi

for role in "${ROLES[@]}"; do
  is_valid_role "$role" || die "invalid role: $role"
done

if [[ -n "$PASSWORD" && -n "$TEMPORARY_PASSWORD" ]]; then
  die "use either --password or --temporary-password, not both."
fi

if [[ "$PERMANENT_PASSWORD" == "true" && -z "$TEMPORARY_PASSWORD" ]]; then
  die "--permanent-password requires --temporary-password."
fi

resolve_user_pool_id

if aws_cli cognito-idp admin-get-user --user-pool-id "$USER_POOL_ID" --username "$EMAIL" >/dev/null 2>&1; then
  echo "User already exists: $EMAIL"
else
  user_attributes=("Name=email,Value=$EMAIL" "Name=email_verified,Value=true")
  if [[ -n "$NAME" ]]; then
    user_attributes+=("Name=name,Value=$NAME")
  fi

  create_args=(
    cognito-idp admin-create-user
    --user-pool-id "$USER_POOL_ID"
    --username "$EMAIL"
    --user-attributes "${user_attributes[@]}"
  )

  if [[ -n "$TEMPORARY_PASSWORD" ]]; then
    create_args+=(--temporary-password "$TEMPORARY_PASSWORD")
  fi

  if [[ -n "$PASSWORD" || "$SUPPRESS_INVITE" == "true" || "$PERMANENT_PASSWORD" == "true" ]]; then
    create_args+=(--message-action SUPPRESS)
  fi

  aws_cli "${create_args[@]}" >/dev/null
  echo "Created user: $EMAIL"
fi

if [[ -n "$PASSWORD" ]]; then
  aws_cli cognito-idp admin-set-user-password \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --password "$PASSWORD" \
    --permanent >/dev/null
  echo "Set permanent password: $EMAIL"
elif [[ "$PERMANENT_PASSWORD" == "true" ]]; then
  aws_cli cognito-idp admin-set-user-password \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --password "$TEMPORARY_PASSWORD" \
    --permanent >/dev/null
  echo "Set temporary password as permanent: $EMAIL"
fi

for role in "${ROLES[@]}"; do
  if ! aws_cli cognito-idp get-group --user-pool-id "$USER_POOL_ID" --group-name "$role" >/dev/null 2>&1; then
    die "Cognito group does not exist: $role. Deploy the CDK stack before assigning users."
  fi

  aws_cli cognito-idp admin-add-user-to-group \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --group-name "$role" >/dev/null
  echo "Assigned role: $role"
done

echo "Done. userPoolId=$USER_POOL_ID username=$EMAIL"
