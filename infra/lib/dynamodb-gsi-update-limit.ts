type CloudFormationResource = {
  Type?: string
  Properties?: {
    GlobalSecondaryIndexes?: Array<{ IndexName?: unknown }>
  }
}

type CloudFormationTemplate = {
  Resources?: Record<string, CloudFormationResource>
}

export type DynamoDbGsiUpdateLimitViolation = {
  logicalId: string
  added: string[]
  removed: string[]
  createDeleteChangeCount: number
}

function tableResources(template: CloudFormationTemplate) {
  return Object.entries(template.Resources ?? {})
    .filter(([, resource]) => resource?.Type === "AWS::DynamoDB::Table")
}

function gsiNames(resource: CloudFormationResource) {
  const indexes = resource.Properties?.GlobalSecondaryIndexes
  if (!Array.isArray(indexes)) return new Set<string>()
  return new Set(indexes
    .map((index) => index?.IndexName)
    .filter((indexName): indexName is string => typeof indexName === "string"))
}

export function findDynamoDbGsiUpdateLimitViolations(
  previousTemplate: CloudFormationTemplate,
  nextTemplate: CloudFormationTemplate
): DynamoDbGsiUpdateLimitViolation[] {
  const previousTables = new Map(tableResources(previousTemplate))
  const violations: DynamoDbGsiUpdateLimitViolation[] = []

  for (const [logicalId, nextResource] of tableResources(nextTemplate)) {
    const previousResource = previousTables.get(logicalId)
    if (!previousResource) continue

    const previousGsiNames = gsiNames(previousResource)
    const nextGsiNames = gsiNames(nextResource)
    const added = [...nextGsiNames].filter((indexName) => !previousGsiNames.has(indexName)).sort()
    const removed = [...previousGsiNames].filter((indexName) => !nextGsiNames.has(indexName)).sort()
    const createDeleteChangeCount = added.length + removed.length

    if (createDeleteChangeCount > 1) {
      violations.push({
        logicalId,
        added,
        removed,
        createDeleteChangeCount
      })
    }
  }

  return violations
}
