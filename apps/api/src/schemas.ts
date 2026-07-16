import { z } from "@hono/zod-openapi"
import { ragRuntimePolicy } from "./chat-orchestration/runtime-policy.js"
import type { JsonValue, ReplayVersionManifest } from "./types.js"
import {
  MANDATORY_RAG_GUARDS,
  SAFE_DEGRADATION_POLICY_VERSION,
  type SafeDegradationDecision
} from "./rag/_shared/security/safe-degradation-policy.js"

const MetadataValueSchema = z.custom<JsonValue>(isJsonValue)
const ReplayVersionManifestSchema = z.custom<ReplayVersionManifest>(
  (value) => isJsonValue(value) && typeof value === "object" && value !== null && !Array.isArray(value) && value.schemaVersion === 1
)
const ReplayDecisionSchema = z.object({
  candidateCount: z.number().int().nonnegative(),
  deniedCandidateCount: z.number().int().nonnegative(),
  finalEvidenceCount: z.number().int().nonnegative(),
  responseStatus: z.enum(["success", "warning", "error"]),
  decisionCode: z.enum(["completed", "refused", "rejected", "failed", "cancelled"]),
  reasonCodes: z.array(z.enum([
    "authorization_denied",
    "safety_interlock",
    "dependency_error",
    "admission_rejected",
    "publication_not_eligible",
    "permission_revoked",
    "execution_error",
    "insufficient_evidence",
    "clarification_required",
    "output_secret_detected",
    "cancelled"
  ])),
  totalLatencyMs: z.number().nonnegative()
})
const MandatoryRagGuardSchema = z.enum(MANDATORY_RAG_GUARDS)
const RagGuardOutcomeSchema = z.object({
  guard: MandatoryRagGuardSchema,
  observed: z.boolean(),
  passed: z.boolean(),
  evidence: z.string(),
  observedAt: z.string().datetime()
})
const SafeDegradationDecisionSchema: z.ZodType<SafeDegradationDecision> = z.object({
  policyVersion: z.literal(SAFE_DEGRADATION_POLICY_VERSION),
  trigger: z.enum(["dependency_error", "timeout", "overload", "cost_limit", "circuit_open", "unsafe_profile"]),
  stage: z.string(),
  action: z.enum(["limited_answer", "refuse", "fail"]),
  enforcedGuards: z.array(MandatoryRagGuardSchema),
  missingGuards: z.array(MandatoryRagGuardSchema),
  safeToReturnContent: z.boolean(),
  guardOutcomes: z.array(RagGuardOutcomeSchema)
})
const DebugStepOutputSchema = z.record(z.string(), MetadataValueSchema)
export const DebugTraceTargetTypeSchema = z.enum(["rag_run", "ingest_run", "chat_orchestration_run", "async_agent_run", "tool_invocation"])
export const DebugTraceVisibilitySchema = z.enum(["user_safe", "support_sanitized", "operator_sanitized", "internal_restricted"])
export const DebugTraceSanitizePolicyVersionSchema = z.literal("debug-trace-sanitize-v1")

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true
  if (["string", "number", "boolean"].includes(typeof value)) return true
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (typeof value !== "object") return false
  return Object.values(value as Record<string, unknown>).every(isJsonValue)
}

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  timestamp: z.string()
})

export const WebSocketTicketResponseSchema = z.object({
  ticket: z.string().regex(/^memorag-ticket\.[A-Za-z0-9_-]{43}$/),
  protocol: z.literal("memorag.v1"),
  expiresAt: z.string().datetime()
})

export const DocumentUploadRequestSchema = z.object({
  fileName: z.string().min(1).openapi({ example: "handbook.md" }),
  text: z.string().optional().openapi({ example: "経費精算は申請から30日以内に行う必要があります。" }),
  contentBase64: z.string().optional(),
  textractJson: z.string().optional(),
  mimeType: z.string().optional().openapi({ example: "text/markdown" }),
  metadata: z.record(MetadataValueSchema).optional(),
  scope: z.object({
    scopeType: z.enum(["personal", "group", "chat", "benchmark"]).optional(),
    groupIds: z.array(z.string().min(1)).max(20).optional(),
    temporaryScopeId: z.string().min(1).optional(),
    expiresAt: z.string().optional()
  }).optional(),
  embeddingModelId: z.string().optional().openapi({ example: "amazon.titan-embed-text-v2:0" }),
  memoryModelId: z.string().optional().openapi({ example: "amazon.nova-lite-v1:0" }),
  skipMemory: z.boolean().optional()
})

export const CreateDocumentUploadRequestSchema = z.object({
  fileName: z.string().min(1).openapi({ example: "handbook.pdf" }),
  mimeType: z.string().optional().openapi({ example: "application/pdf" }),
  purpose: z.enum(["document", "benchmarkSeed", "chatAttachment"]).optional().default("document")
})

export const CreateDocumentUploadResponseSchema = z.object({
  uploadId: z.string(),
  objectKey: z.string(),
  uploadUrl: z.string().url(),
  method: z.enum(["PUT", "POST"]),
  headers: z.record(z.string(), z.string()),
  expiresInSeconds: z.number().int().positive(),
  requiresAuth: z.boolean(),
  maxUploadBytes: z.number().int().positive()
})

export const IngestUploadedDocumentRequestSchema = z.object({
  fileName: z.string().min(1).openapi({ example: "handbook.pdf" }),
  mimeType: z.string().optional().openapi({ example: "application/pdf" }),
  metadata: z.record(MetadataValueSchema).optional(),
  scope: z.object({
    scopeType: z.enum(["personal", "group", "chat", "benchmark"]).optional(),
    groupIds: z.array(z.string().min(1)).max(20).optional(),
    temporaryScopeId: z.string().min(1).optional(),
    expiresAt: z.string().optional()
  }).optional(),
  embeddingModelId: z.string().optional().openapi({ example: "amazon.titan-embed-text-v2:0" }),
  memoryModelId: z.string().optional().openapi({ example: "amazon.nova-lite-v1:0" }),
  skipMemory: z.boolean().optional()
})

export const PipelineVersionsSchema = z.object({
  chatOrchestrationWorkflowVersion: z.string(),
  agentWorkflowVersion: z.string(),
  chunkerVersion: z.string(),
  sourceExtractorVersion: z.string(),
  memoryPromptVersion: z.string(),
  promptVersion: z.string(),
  indexVersion: z.string(),
  embeddingModelId: z.string(),
  embeddingDimensions: z.number().int().positive()
})

const VersionedRecordReferenceSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  hash: z.string().regex(/^[a-f0-9]{64}$/i)
})

const SourceLocationSchema = z.object({
  page: z.number().int().positive().optional(),
  pageStart: z.number().int().positive().optional(),
  pageEnd: z.number().int().positive().optional(),
  bbox: MetadataValueSchema.optional(),
  unit: z.enum(["normalized_page", "pdf_point", "pixel", "unknown"]).optional(),
  source: z.string().optional(),
  sectionPath: z.array(z.string()).optional(),
  startChar: z.number().int().nonnegative().optional(),
  endChar: z.number().int().nonnegative().optional(),
  sourceBlockId: z.string().optional(),
  sourceChunkIds: z.array(z.string()).optional()
})

const DerivedRecordSecurityEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  documentId: z.string(),
  documentVersion: z.string(),
  tenantId: z.string(),
  authorizationRef: VersionedRecordReferenceSchema,
  classificationRef: VersionedRecordReferenceSchema,
  usagePolicyRef: VersionedRecordReferenceSchema,
  qualityRef: VersionedRecordReferenceSchema,
  lifecycleRef: VersionedRecordReferenceSchema,
  provenanceRef: VersionedRecordReferenceSchema,
  sourceLocator: SourceLocationSchema,
  envelopeHash: z.string().regex(/^[a-f0-9]{64}$/i)
})

export const RagProfileTraceSchema = z.object({
  id: z.string(),
  version: z.string(),
  retrievalProfileId: z.string(),
  retrievalProfileVersion: z.string(),
  answerPolicyId: z.string(),
  answerPolicyVersion: z.string()
})

const ChunkMetadataSchema = z.object({
  id: z.string(),
  startChar: z.number().int().nonnegative(),
  endChar: z.number().int().nonnegative(),
  sectionPath: z.array(z.string()).optional(),
  heading: z.string().optional(),
  parentSectionId: z.string().optional(),
  previousChunkId: z.string().optional(),
  nextChunkId: z.string().optional(),
  chunkHash: z.string().optional(),
  pageStart: z.number().int().positive().optional(),
  pageEnd: z.number().int().positive().optional(),
  chunkKind: z.enum(["text", "table", "list", "code", "figure"]).optional(),
  sourceBlockId: z.string().optional(),
  normalizedFrom: z.string().optional(),
  tableColumnCount: z.number().int().positive().optional(),
  tableId: z.string().optional(),
  tableRowCount: z.number().int().positive().optional(),
  tableConfidence: z.number().optional(),
  listDepth: z.number().int().positive().optional(),
  codeLanguage: z.string().optional(),
  figureCaption: z.string().optional(),
  figureId: z.string().optional(),
  confidence: z.number().optional(),
  readingOrder: z.number().int().nonnegative().optional(),
  bbox: MetadataValueSchema.optional(),
  sourceLocation: SourceLocationSchema.optional(),
  extractionMethod: z.string().optional(),
  securityEnvelope: DerivedRecordSecurityEnvelopeSchema.optional()
})

const ExtractionWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "error"]),
  page: z.number().int().positive().optional(),
  pageStart: z.number().int().positive().optional(),
  pageEnd: z.number().int().positive().optional(),
  sectionPath: z.array(z.string()).optional(),
  startChar: z.number().int().nonnegative().optional(),
  endChar: z.number().int().nonnegative().optional(),
  sourceBlockId: z.string().optional(),
  confidence: z.number().optional(),
  degradationDecision: SafeDegradationDecisionSchema.optional()
})

const DocumentQualityProfileSchema = z.object({
  knowledgeQualityStatus: z.enum(["approved", "warning", "blocked"]).optional(),
  verificationStatus: z.enum(["verified", "unverified", "rejected"]).optional(),
  freshnessStatus: z.enum(["current", "stale", "expired"]).optional(),
  supersessionStatus: z.enum(["current", "superseded"]).optional(),
  extractionQualityStatus: z.enum(["high", "medium", "low", "unusable"]).optional(),
  ragEligibility: z.enum(["eligible", "eligible_with_warning", "excluded"]).optional(),
  confidence: z.number().optional(),
  flags: z.array(z.enum([
    "verification_required",
    "freshness_review_required",
    "superseded_by_newer_document",
    "low_extraction_confidence",
    "manual_rag_exclusion"
  ])).optional(),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional()
})

const SourceClassificationSchema = z.object({
  level: z.enum(["public", "internal", "confidential", "restricted"]),
  policyVersion: z.string().trim().min(1).max(200)
})

const SourceUsagePurposeSchema = z.enum(["normal_rag", "external_model", "logging", "evaluation"])

const SourceUsagePolicySchema = z.object({
  allowedPurposes: z.array(SourceUsagePurposeSchema).min(1).max(4),
  externalModelAllowed: z.boolean(),
  loggingAllowed: z.boolean(),
  evaluationAllowed: z.boolean(),
  policyVersion: z.string().trim().min(1).max(200)
})

const ExplicitSourceQualityProfileSchema = z.object({
  knowledgeQualityStatus: z.literal("approved"),
  verificationStatus: z.literal("verified"),
  freshnessStatus: z.literal("current"),
  supersessionStatus: z.literal("current"),
  extractionQualityStatus: z.literal("high"),
  ragEligibility: z.literal("eligible"),
  confidence: z.number().min(0).max(1).optional(),
  flags: z.array(z.enum([
    "verification_required",
    "freshness_review_required",
    "superseded_by_newer_document",
    "low_extraction_confidence",
    "manual_rag_exclusion"
  ])).max(0)
})

export const ApproveSourceGovernanceRequestSchema = z.object({
  expectedVersion: z.string().trim().min(1).max(500),
  reason: z.string().trim().min(1).max(1000),
  classification: SourceClassificationSchema,
  usagePolicy: SourceUsagePolicySchema,
  qualityProfile: ExplicitSourceQualityProfileSchema,
  qualityPolicyVersion: z.string().trim().min(1).max(200),
  inspection: z.object({
    status: z.literal("passed"),
    profileVersion: z.string().trim().min(1).max(200)
  })
})

export const RestrictSourceGovernanceRequestSchema = z.object({
  expectedVersion: z.string().trim().min(1).max(500),
  reason: z.string().trim().min(1).max(1000),
  dimensions: z.array(z.enum(["classification", "quality", "lifecycle"])).max(3).optional(),
  deniedPurposes: z.array(z.enum(["normal_rag", "external_model", "logging", "evaluation"])).max(4).optional()
})

const ApprovedSourceGovernancePolicySchema = z.object({
  classification: SourceClassificationSchema,
  usagePolicy: SourceUsagePolicySchema,
  qualityProfile: DocumentQualityProfileSchema,
  inspection: z.object({ status: z.literal("passed"), profileVersion: z.string() }),
  classificationRef: VersionedRecordReferenceSchema,
  usagePolicyRef: VersionedRecordReferenceSchema,
  qualityRef: VersionedRecordReferenceSchema,
  approvedBy: z.string(),
  approvedAt: z.string(),
  reason: z.string()
})

export const SourceGovernanceRecordSchema = z.object({
  schemaVersion: z.literal(1),
  sourceId: z.string(),
  sourceVersion: z.string(),
  sourceManifestObjectKey: z.string(),
  tenantId: z.string(),
  ownerUserId: z.string(),
  status: z.enum(["unreviewed", "approval_pending", "approved", "published", "restricted", "reconciliation_required"]),
  revision: z.number().int().positive(),
  approval: ApprovedSourceGovernancePolicySchema.optional(),
  restriction: z.object({
    dimensions: z.array(z.enum(["classification", "quality", "lifecycle"])),
    deniedPurposes: z.array(z.enum(["normal_rag", "external_model", "logging", "evaluation"])),
    restrictedBy: z.string(),
    restrictedAt: z.string(),
    reason: z.string()
  }).optional(),
  auditIntentId: z.string().optional(),
  stagedPublication: z.object({
    runId: z.string(),
    candidateDocumentId: z.string(),
    candidateManifestObjectKey: z.string()
  }).optional(),
  activeDocumentId: z.string().optional(),
  publishedAt: z.string().optional(),
  lastFailureCode: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
})

const PublicSourceGovernanceRecordSchema = SourceGovernanceRecordSchema
  .omit({ sourceManifestObjectKey: true, stagedPublication: true })
  .extend({
    stagedPublication: z.object({
      runId: z.string(),
      candidateDocumentId: z.string()
    }).optional()
  })

export const VersionedSourceGovernanceRecordSchema = z.object({
  record: PublicSourceGovernanceRecordSchema,
  version: z.string()
})

const ParsedDocumentSchema = z.object({
  schemaVersion: z.literal(2),
  text: z.string(),
  sourceExtractorVersion: z.string(),
  fileProfile: z.enum(["digital_text", "scanned_image", "mixed", "image_only", "unknown"]).optional(),
  pages: z.array(z.record(z.string(), MetadataValueSchema)).optional(),
  blocks: z.array(z.record(z.string(), MetadataValueSchema)).optional(),
  tables: z.array(z.record(z.string(), MetadataValueSchema)).optional(),
  figures: z.array(z.record(z.string(), MetadataValueSchema)).optional(),
  warnings: z.array(ExtractionWarningSchema).optional(),
  counters: z.record(z.string(), z.number()).optional(),
  extractionStatus: z.enum(["complete", "partial"]).optional(),
  inputCharCount: z.number().int().nonnegative().optional(),
  outputCharCount: z.number().int().nonnegative().optional(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/i).optional()
})

const SourceAdmissionRecordSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(["approved", "quarantined", "rejected"]),
  tenantId: z.string().optional(),
  ownerUserId: z.string().optional(),
  authorizationRef: VersionedRecordReferenceSchema.optional(),
  classificationRef: VersionedRecordReferenceSchema.optional(),
  usagePolicyRef: VersionedRecordReferenceSchema.optional(),
  qualityRef: VersionedRecordReferenceSchema.optional(),
  lifecycleRef: VersionedRecordReferenceSchema.optional(),
  provenanceRef: VersionedRecordReferenceSchema.optional(),
  inspectionStatus: z.enum(["passed", "failed", "unknown"]),
  reasons: z.array(z.string()),
  rejectedProtectedMetadataKeys: z.array(z.string()),
  admittedAt: z.string(),
  degradationDecision: SafeDegradationDecisionSchema.optional()
})

const DerivedArtifactIntegritySchema = z.object({
  schemaVersion: z.literal(1),
  expectedChunkCount: z.number().int().nonnegative(),
  expectedMemoryCardCount: z.number().int().nonnegative(),
  evidenceRecordCount: z.number().int().nonnegative(),
  memoryRecordCount: z.number().int().nonnegative(),
  manifestHash: z.string().regex(/^[a-f0-9]{64}$/i),
  recordSetHash: z.string().regex(/^[a-f0-9]{64}$/i),
  objectHashes: z.object({
    source: z.string().regex(/^[a-f0-9]{64}$/i),
    structuredBlocks: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
    memoryCards: z.string().regex(/^[a-f0-9]{64}$/i).optional()
  }).optional(),
  verified: z.boolean(),
  reasons: z.array(z.string())
})

const ChunkingPolicySnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  policyId: z.string(),
  version: z.string(),
  strategy: z.literal("structure_aware"),
  tokenizer: z.literal("unicode_code_point_v1"),
  maxChars: z.number().int().positive(),
  maxTokens: z.number().int().positive(),
  overlapChars: z.number().int().nonnegative(),
  minTokens: z.number().int().positive(),
  preserveAtomicBlocks: z.boolean(),
  stableIdAlgorithm: z.literal("sha256_locator_content_v1")
})

const ChunkingViolationSchema = z.object({
  code: z.enum(["invalid_policy", "missing_locator", "oversized_atomic_block", "char_budget_exceeded", "token_budget_exceeded", "fragment_below_minimum"]),
  message: z.string(),
  sourceBlockId: z.string().optional(),
  chunkId: z.string().optional()
})

const PublicationPurposeSchema = z.enum(["ingest", "reindex", "rollback"])

const StagedPublicationFenceSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string(),
  artifactId: z.string(),
  idempotencyKey: z.string(),
  sourceId: z.string(),
  purpose: PublicationPurposeSchema,
  stageNamespace: z.string(),
  generation: z.number().int().positive(),
  fencingToken: z.string()
})

const PublicationControlSchema = z.object({
  schemaVersion: z.literal(1),
  sourceId: z.string(),
  purpose: PublicationPurposeSchema,
  activePointerKey: z.string(),
  artifactId: z.string(),
  runId: z.string(),
  generation: z.number().int().nonnegative(),
  fencingToken: z.string()
})

export const DocumentManifestSchema = z.object({
  documentId: z.string(),
  documentVersion: z.string().optional(),
  traceId: z.string().optional(),
  replayVersionManifest: ReplayVersionManifestSchema.optional(),
  fileName: z.string(),
  mimeType: z.string().optional(),
  metadata: z.record(MetadataValueSchema).optional(),
  qualityProfile: DocumentQualityProfileSchema.optional(),
  admission: SourceAdmissionRecordSchema.optional(),
  derivedIntegrity: DerivedArtifactIntegritySchema.optional(),
  securityEnvelope: DerivedRecordSecurityEnvelopeSchema.optional(),
  chunkingPolicy: ChunkingPolicySnapshotSchema.optional(),
  chunkingViolations: z.array(ChunkingViolationSchema).optional(),
  publicationEligible: z.boolean().optional(),
  processingStatus: z.enum(["complete", "partial", "quarantined", "rejected"]).optional(),
  publicationFence: StagedPublicationFenceSchema.optional(),
  publicationControl: PublicationControlSchema.optional(),
  sourceObjectKey: z.string(),
  structuredBlocksObjectKey: z.string().optional(),
  memoryCardsObjectKey: z.string().optional(),
  manifestObjectKey: z.string(),
  vectorKeys: z.array(z.string()),
  memoryVectorKeys: z.array(z.string()).optional(),
  evidenceVectorKeys: z.array(z.string()).optional(),
  embeddingModelId: z.string().optional(),
  embeddingDimensions: z.number().int().positive().optional(),
  chunkerVersion: z.string().optional(),
  sourceExtractorVersion: z.string().optional(),
  memoryPromptVersion: z.string().optional(),
  indexVersion: z.string().optional(),
  pipelineVersions: PipelineVersionsSchema.optional(),
  chunks: z.array(ChunkMetadataSchema).optional(),
  parsedDocument: ParsedDocumentSchema.optional(),
  extractionWarnings: z.array(ExtractionWarningSchema).optional(),
  extractionCounters: z.record(z.string(), z.number()).optional(),
  fileProfile: z.enum(["digital_text", "scanned_image", "mixed", "image_only", "unknown"]).optional(),
  lifecycleStatus: z.enum(["active", "staging", "superseded"]).optional(),
  activeDocumentId: z.string().optional(),
  stagedFromDocumentId: z.string().optional(),
  reindexMigrationId: z.string().optional(),
  chunkCount: z.number(),
  memoryCardCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string().optional()
})

export const DocumentGroupSchema = z.object({
  groupId: z.string(),
  schemaVersion: z.number().int().positive().optional(),
  itemType: z.literal("documentGroup").optional(),
  tenantId: z.string().optional(),
  adminPrincipalType: z.enum(["user", "group"]),
  adminPrincipalId: z.string(),
  name: z.string(),
  normalizedName: z.string(),
  canonicalPath: z.string(),
  normalizedCanonicalPath: z.string(),
  adminPathPk: z.string(),
  parentPathPk: z.string(),
  description: z.string().optional(),
  parentGroupId: z.string().optional(),
  ancestorGroupIds: z.array(z.string()).optional(),
  ownerUserId: z.string(),
  visibility: z.enum(["private", "shared", "org"]),
  sharedUserIds: z.array(z.string()),
  sharedGroups: z.array(z.string()),
  managerUserIds: z.array(z.string()),
  hasExplicitPolicy: z.boolean().optional(),
  policyId: z.string().optional(),
  status: z.enum(["active", "archived"]).optional(),
  createdBy: z.string().optional(),
  effectivePermission: z.enum(["none", "readOnly", "full"]).optional(),
  policySource: z.enum(["explicit", "inherited", "ownerDefault", "none"]).optional(),
  inheritedFromFolderId: z.string().optional(),
  inheritedPolicyId: z.string().optional(),
  inheritedPolicyVersion: z.string().optional(),
  folderLocalPolicyVersion: z.string().optional(),
  folderProjectionVersion: z.string().optional(),
  folderMoveOperationId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const FolderPolicyEntrySchema = z.object({
  principalType: z.enum(["user", "group"]),
  principalId: z.string(),
  permissionLevel: z.enum(["deny", "readOnly", "full"])
})

export const DocumentShareGrantSchema = z.object({
  documentShareGrantId: z.string(),
  itemType: z.literal("documentShareGrant").optional(),
  tenantId: z.string(),
  documentId: z.string(),
  principalType: z.enum(["user", "group"]),
  principalId: z.string(),
  permissionLevel: z.enum(["deny", "readOnly", "full"]),
  createdBy: z.string(),
  reason: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const DocumentShareRequestSchema = z.object({
  grants: z.array(z.object({
    principalType: z.enum(["user", "group"]),
    principalId: z.string().min(1),
    permissionLevel: z.enum(["deny", "readOnly", "full"])
  })),
  expectedVersion: z.string().min(1),
  reason: z.string().min(1)
})

export const DocumentShareResponseSchema = z.object({
  inheritedFolderGrants: z.array(z.object({
    folderId: z.string(),
    permissionLevel: z.enum(["none", "readOnly", "full"])
  })),
  directDocumentGrants: z.array(DocumentShareGrantSchema),
  currentUserEffectivePermission: z.enum(["none", "readOnly", "full"]),
  version: z.string().min(1)
})

export const DocumentMoveRequestSchema = z.object({
  destinationFolderId: z.string().min(1),
  newTitle: z.string().min(1).optional(),
  reason: z.string().min(1),
  expectedUpdatedAt: z.string().optional()
})

export const DocumentMoveResponseSchema = z.object({
  document: DocumentManifestSchema,
  before: z.object({
    folderIds: z.array(z.string()),
    fileName: z.string()
  }),
  after: z.object({
    folderIds: z.array(z.string()),
    fileName: z.string()
  }),
  directDocumentGrantsPreserved: z.boolean()
})

export const FolderMoveRequestSchema = z.object({
  destinationParentId: z.string().min(1).max(200)
    .refine((value) => value.trim() === value, "destinationParentId must not contain surrounding whitespace")
    .nullable(),
  newName: z.string().min(1).max(120)
    .refine((value) => value.trim() === value, "newName must not contain surrounding whitespace")
    .refine((value) => !value.includes("/") && !value.includes("\\"), "newName must not contain path separators")
    .optional(),
  reason: z.string().min(1).max(1000)
    .refine((value) => value.trim() === value, "reason must not contain surrounding whitespace"),
  expectedVersion: z.string().min(1).max(500)
    .refine((value) => value.trim() === value, "expectedVersion must not contain surrounding whitespace")
}).strict()

export const FolderMoveResponseSchema = z.object({
  operationId: z.string().min(1),
  folder: DocumentGroupSchema,
  subtree: z.array(DocumentGroupSchema),
  affectedDocumentCount: z.number().int().nonnegative(),
  directDocumentGrantsPreserved: z.literal(true),
  folderLocalPoliciesPreserved: z.literal(true),
  documentVersionsPreserved: z.literal(true)
})

export const ArchiveFolderRequestSchema = z.object({
  expectedVersion: z.string().min(1).max(500)
    .refine((value) => value.trim() === value, "expectedVersion must not contain surrounding whitespace"),
  reason: z.string().min(1).max(1000)
    .refine((value) => value.trim() === value, "reason must not contain surrounding whitespace")
}).strict()

export const ArchiveFolderResponseSchema = z.object({
  folder: DocumentGroupSchema
})

export const FolderPolicySchema = z.object({
  policyId: z.string(),
  itemType: z.literal("folderPolicy").optional(),
  tenantId: z.string(),
  folderId: z.string(),
  entries: z.array(FolderPolicyEntrySchema),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const VersionedFolderPolicyResponseSchema = z.object({
  policy: FolderPolicySchema.nullable(),
  version: z.string().min(1)
})

export const ReplaceVersionedFolderPolicyRequestSchema = z.object({
  expectedVersion: z.string().trim().min(1).max(500),
  entries: z.array(FolderPolicyEntrySchema.extend({
    principalId: z.string().trim().min(1).max(200)
  }).strict()).min(1).max(200),
  reason: z.string().trim().min(1).max(1000)
}).strict()

export const ReplaceVersionedFolderPolicyResponseSchema = z.object({
  policy: FolderPolicySchema,
  version: z.string().min(1),
  auditIntentId: z.string().min(1)
})

export const UserGroupSchema = z.object({
  groupId: z.string(),
  itemType: z.literal("userGroup").optional(),
  tenantId: z.string().optional(),
  name: z.string(),
  type: z.enum(["department", "project", "team", "admin", "folderPolicy", "system", "custom"]),
  parentGroupId: z.string().optional(),
  ancestorGroupIds: z.array(z.string()),
  status: z.enum(["active", "archived"]),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const GroupMembershipSchema = z.object({
  membershipId: z.string().optional(),
  itemType: z.literal("groupMembership").optional(),
  tenantId: z.string().optional(),
  groupId: z.string(),
  memberType: z.enum(["user", "group"]),
  memberId: z.string(),
  permissionLevel: z.enum(["readOnly", "full"]),
  source: z.enum(["manual", "external", "system"]),
  createdAt: z.string(),
  updatedAt: z.string()
})

const CanonicalResourceGroupMembershipIdSchema = z.string()
  .min(1)
  .max(200)
  .refine((value) => value.trim() === value, "identifier must not contain surrounding whitespace")

export const ResourceGroupMembershipEntrySchema = z.object({
  memberType: z.enum(["user", "group"]),
  memberId: CanonicalResourceGroupMembershipIdSchema,
  permissionLevel: z.enum(["readOnly", "full"])
}).strict()

export const ReplaceResourceGroupMembershipsRequestSchema = z.object({
  expectedVersion: z.string()
    .min(1)
    .max(500)
    .refine((value) => value.trim() === value, "expectedVersion must not contain surrounding whitespace"),
  memberships: z.array(ResourceGroupMembershipEntrySchema).max(99),
  reason: z.string()
    .min(1)
    .max(1000)
    .refine((value) => value.trim() === value, "reason must not contain surrounding whitespace")
}).strict().superRefine((value, ctx) => {
  const seen = new Set<string>()
  for (const [index, membership] of value.memberships.entries()) {
    const key = `${membership.memberType}:${membership.memberId}`
    if (!seen.has(key)) {
      seen.add(key)
      continue
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["memberships", index],
      message: "duplicate membership principal"
    })
  }
})

export const ResourceGroupMembershipStateSchema = z.object({
  groupId: CanonicalResourceGroupMembershipIdSchema,
  version: z.string().min(1).max(500),
  memberships: z.array(ResourceGroupMembershipEntrySchema).max(99)
})

export const ResourceGroupPublicSchema = z.object({
  groupId: CanonicalResourceGroupMembershipIdSchema,
  name: z.string().min(1).max(200),
  type: z.enum(["department", "project", "team", "admin", "folderPolicy", "system", "custom"]),
  status: z.enum(["active", "archived"]),
  version: z.string().min(1).max(500)
}).strict()

export const ResourceGroupListResponseSchema = z.object({
  resourceGroups: z.array(ResourceGroupPublicSchema),
  count: z.number().int().nonnegative()
}).strict()

export const CreateResourceGroupRequestSchema = z.object({
  groupId: CanonicalResourceGroupMembershipIdSchema,
  name: z.string().min(1).max(200).refine((value) => value.trim() === value),
  type: z.enum(["department", "project", "team", "admin", "folderPolicy", "system", "custom"]),
  expectedVersion: z.literal("absent"),
  reason: z.string().min(1).max(1000).refine((value) => value.trim() === value)
}).strict()

export const UpdateResourceGroupRequestSchema = z.object({
  name: z.string().min(1).max(200).refine((value) => value.trim() === value),
  type: z.enum(["department", "project", "team", "admin", "folderPolicy", "system", "custom"]),
  expectedVersion: z.string().min(1).max(500).refine((value) => value.trim() === value),
  reason: z.string().min(1).max(1000).refine((value) => value.trim() === value)
}).strict()

export const DeleteResourceGroupRequestSchema = z.object({
  expectedVersion: z.string().min(1).max(500).refine((value) => value.trim() === value),
  reason: z.string().min(1).max(1000).refine((value) => value.trim() === value)
}).strict()

export const UnsupportedResourceGroupMutationRequestSchema = DeleteResourceGroupRequestSchema

const ResourceCollectionProfileVersionSchema = z.literal("resource-non-enumeration-v1")

const DocumentGroupCapabilitiesSchema = z.object({
  canRead: z.boolean(),
  canManage: z.boolean()
})

export const DocumentGroupReaderListItemSchema = z.object({
  detailLevel: z.literal("reader"),
  groupId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  canonicalPath: z.string().optional(),
  parentGroupId: z.string().optional(),
  ancestorGroupIds: z.array(z.string()).optional(),
  effectivePermission: z.enum(["none", "readOnly"]).optional(),
  capabilities: DocumentGroupCapabilitiesSchema
})

export const DocumentGroupManagerListItemSchema = DocumentGroupSchema.extend({
  detailLevel: z.literal("manager"),
  effectivePermission: z.literal("full"),
  capabilities: DocumentGroupCapabilitiesSchema
})

export const DocumentGroupListResponseSchema = z.object({
  groups: z.array(z.union([DocumentGroupReaderListItemSchema, DocumentGroupManagerListItemSchema])),
  count: z.number().int().nonnegative(),
  nextCursor: z.string().optional(),
  responseProfileVersion: ResourceCollectionProfileVersionSchema
})

export const CreateDocumentGroupRequestSchema = z.object({
  name: z.string().min(1).max(120).openapi({ example: "社内規定" }),
  description: z.string().max(1000).optional(),
  parentGroupId: z.string().min(1).optional()
}).strict()

export const ShareDocumentGroupRequestSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).optional()
}).strict()

export const DocumentManifestSummarySchema = DocumentManifestSchema.pick({
  documentId: true,
  fileName: true,
  mimeType: true,
  chunkCount: true,
  memoryCardCount: true,
  createdAt: true,
  lifecycleStatus: true,
  activeDocumentId: true,
  stagedFromDocumentId: true,
  reindexMigrationId: true,
  chunkerVersion: true,
  sourceExtractorVersion: true
})

const DocumentCapabilitiesSchema = z.object({
  canRead: z.boolean(),
  canShare: z.boolean(),
  canMove: z.boolean(),
  canDelete: z.boolean(),
  canReindex: z.boolean()
})

export const DocumentReaderListItemSummarySchema = z.object({
  detailLevel: z.literal("reader"),
  documentId: z.string(),
  fileName: z.string(),
  mimeType: z.string().optional(),
  createdAt: z.string(),
  metadata: z.record(MetadataValueSchema).optional(),
  currentUserEffectivePermission: z.enum(["none", "readOnly"]).optional(),
  capabilities: DocumentCapabilitiesSchema.optional()
})

export const DocumentManagerListItemSummarySchema = DocumentManifestSummarySchema.extend({
  detailLevel: z.literal("manager"),
  metadata: z.record(MetadataValueSchema).optional(),
  embeddingModelId: z.string().optional(),
  embeddingDimensions: z.number().int().positive().optional(),
  currentUserEffectivePermission: z.literal("full"),
  capabilities: DocumentCapabilitiesSchema.optional()
})

export const DocumentListItemSummarySchema = z.union([
  DocumentReaderListItemSummarySchema,
  DocumentManagerListItemSummarySchema
])

export const DocumentListResponseSchema = z.object({
  documents: z.array(DocumentListItemSummarySchema),
  count: z.number().int().nonnegative(),
  nextCursor: z.string().optional(),
  responseProfileVersion: ResourceCollectionProfileVersionSchema
})

export const ParsedDocumentPreviewSchema = z.object({
  documentId: z.string(),
  fileName: z.string(),
  sourceExtractorVersion: z.string().optional(),
  fileProfile: z.enum(["digital_text", "scanned_image", "mixed", "image_only", "unknown"]).optional(),
  textPreview: z.string().optional(),
  pageCount: z.number().int().nonnegative(),
  blockCount: z.number().int().nonnegative(),
  tableCount: z.number().int().nonnegative(),
  figureCount: z.number().int().nonnegative(),
  warnings: z.array(ExtractionWarningSchema),
  counters: z.record(z.string(), z.number()).optional(),
  pages: z.array(z.record(z.string(), MetadataValueSchema)).optional(),
  blocks: z.array(z.record(z.string(), MetadataValueSchema)).optional(),
  tables: z.array(z.record(z.string(), MetadataValueSchema)).optional(),
  figures: z.array(z.record(z.string(), MetadataValueSchema)).optional(),
  qualityProfile: DocumentQualityProfileSchema.optional(),
  available: z.boolean(),
  unavailableReason: z.string().optional()
})

export const StartDocumentIngestRunRequestSchema = IngestUploadedDocumentRequestSchema.extend({
  uploadId: z.string().min(1)
})

export const DocumentIngestRunSchema = z.object({
  runId: z.string(),
  tenantPartitionId: z.string().optional(),
  status: z.enum(["queued", "running", "succeeded", "rejected", "failed", "cancelled"]),
  createdBy: z.string(),
  tenantId: z.string().optional(),
  userEmail: z.string().optional(),
  userGroups: z.array(z.string()).optional(),
  uploadId: z.string(),
  objectKey: z.string(),
  purpose: z.enum(["document", "benchmarkSeed", "chatAttachment"]),
  fileName: z.string(),
  mimeType: z.string().optional(),
  metadata: z.record(MetadataValueSchema).optional(),
  embeddingModelId: z.string().optional(),
  memoryModelId: z.string().optional(),
  skipMemory: z.boolean().optional(),
  manifest: DocumentManifestSummarySchema.optional(),
  documentId: z.string().optional(),
  traceId: z.string().optional(),
  replayVersionManifest: ReplayVersionManifestSchema.optional(),
  error: z.string().optional(),
  errorCode: z.enum(["validation_error", "not_found", "permission_revoked", "execution_error"]).optional(),
  stage: z.string().optional(),
  counters: z.record(z.string(), z.number()).optional(),
  warnings: z.array(ExtractionWarningSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional()
})

export const DocumentIngestRunStartResponseSchema = z.object({
  runId: z.string(),
  status: z.enum(["queued", "running", "succeeded", "rejected", "failed", "cancelled"]),
  eventsPath: z.string()
})

export const DeleteDocumentResponseSchema = z.object({
  documentId: z.string(),
  deletedVectorCount: z.number()
})

export const DeleteDocumentRequestSchema = z.object({
  expectedUpdatedAt: z.string().min(1),
  reason: z.string().trim().min(1).max(500)
}).strict()

export const ReindexMigrationSchema = z.object({
  migrationId: z.string(),
  sourceDocumentId: z.string(),
  stagedDocumentId: z.string(),
  activeDocumentId: z.string().optional(),
  status: z.enum(["staged", "cutover", "rolled_back"]),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  cutoverAt: z.string().optional(),
  rolledBackAt: z.string().optional(),
  previousManifestObjectKey: z.string(),
  stagedManifestObjectKey: z.string(),
  publicationRunId: z.string().optional(),
  publicationArtifactId: z.string().optional(),
  publicationIdempotencyKey: z.string().optional(),
  activePointerKey: z.string().optional(),
  generation: z.number().int().nonnegative().optional(),
  fencingToken: z.string().optional(),
  checkpoint: z.string().optional()
})

export const ReindexMigrationListResponseSchema = z.object({
  migrations: z.array(ReindexMigrationSchema)
})

export const CurrentUserResponseSchema = z.object({
  user: z.object({
    userId: z.string(),
    email: z.string().optional(),
    groups: z.array(z.string()),
    permissions: z.array(z.string())
  })
})

export const ManagedUserStatusSchema = z.enum(["active", "suspended", "deleted"])

export const ManagedUserSchema = z.object({
  userId: z.string(),
  email: z.string(),
  displayName: z.string().optional(),
  status: ManagedUserStatusSchema,
  groups: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastLoginAt: z.string().optional(),
  operationEvidence: z.object({
    auditIntentId: z.string(),
    sessionRevocation: z.enum(["confirmed", "not_required"]),
    propagationState: z.enum(["current", "reconciliation_required"]),
    effectivePermissions: z.array(z.string())
  }).optional()
})

export const ManagedUserAdminViewSchema = ManagedUserSchema.extend({
  capability: z.object({
    canAssignRoles: z.boolean(),
    canSuspend: z.boolean(),
    canUnsuspend: z.boolean(),
    canDelete: z.boolean(),
    blockers: z.array(z.string())
  }),
  effectivePermissions: z.array(z.string()),
  projection: z.object({
    source: z.enum(["authoritative_identity", "local_ledger"]),
    asOf: z.string(),
    reconciliationState: z.enum(["current", "pending"])
  })
})

export const ManagedUserDeletionPreflightSchema = z.object({
  targetUserId: z.string(),
  requiresSuccessor: z.boolean(),
  ownedResources: z.object({
    folders: z.number().int().nonnegative(),
    resourceGroups: z.number().int().nonnegative(),
    documents: z.number().int().nonnegative(),
    total: z.number().int().nonnegative()
  }),
  eligibleSuccessors: z.array(z.object({
    userId: z.string(),
    email: z.string(),
    displayName: z.string().optional(),
    status: z.literal("active")
  }))
})

export const AdministrativePrincipalTransferRequestSchema = z.object({
  successorUserId: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(1000)
})

export const AdministrativePrincipalTransferResponseSchema = z.object({
  operationId: z.string().optional(),
  transferredFolders: z.number().int().nonnegative(),
  transferredResourceGroups: z.number().int().nonnegative(),
  transferredDocuments: z.number().int().nonnegative()
})

export const CreateManagedUserRequestSchema = z.object({
  email: z.string().email().openapi({ example: "new-user@example.com" }),
  displayName: z.string().min(1).max(120).optional().openapi({ example: "新規 利用者" }),
  groups: z.array(z.string().min(1)).min(1).max(12).optional().openapi({ example: ["CHAT_USER"] })
})

export const ManagedUserAuditActionSchema = z.string().trim().min(1).max(160)

export const ManagedUserAuditLogEntrySchema = z.object({
  auditId: z.string(),
  action: ManagedUserAuditActionSchema,
  result: z.enum(["pending", "success", "denied", "conflict", "failed"]),
  reason: z.string(),
  tenantId: z.string(),
  targetType: z.string(),
  actorUserId: z.string(),
  actorEmail: z.string().optional(),
  targetUserId: z.string(),
  targetEmail: z.string().optional(),
  policyVersion: z.string(),
  source: z.enum(["security_audit_outbox", "legacy_admin_ledger"]),
  beforeStatus: ManagedUserStatusSchema.optional(),
  afterStatus: ManagedUserStatusSchema.optional(),
  beforeGroups: z.array(z.string()),
  afterGroups: z.array(z.string()),
  createdAt: z.string(),
  completedAt: z.string().optional()
})

export const AdminListPageMetadataSchema = z.object({
  total: z.number().int().nonnegative(),
  nextCursor: z.string().optional(),
  truncated: z.boolean(),
  source: z.string(),
  asOf: z.string(),
  version: z.string().optional()
})

export const AdminAuditLogResponseSchema = AdminListPageMetadataSchema.extend({
  auditLog: z.array(ManagedUserAuditLogEntrySchema)
})

export const ManagedUserListResponseSchema = AdminListPageMetadataSchema.extend({
  version: z.string(),
  users: z.array(ManagedUserAdminViewSchema)
})

const AdminPageCursorSchema = z.string().min(1).max(2048).optional()
const AdminPageLimitSchema = z.coerce.number().int().min(1).max(100).optional()
const AdminListSearchSchema = z.string().trim().min(1).max(120).optional()

export const AdminAuditLogQuerySchema = z.object({
  cursor: AdminPageCursorSchema,
  limit: AdminPageLimitSchema,
  query: AdminListSearchSchema,
  action: ManagedUserAuditActionSchema.optional()
})

export const ManagedUserListQuerySchema = z.object({
  cursor: AdminPageCursorSchema,
  limit: AdminPageLimitSchema,
  query: AdminListSearchSchema,
  status: ManagedUserStatusSchema.exclude(["deleted"]).optional(),
  sort: z.enum(["emailAsc", "updatedDesc"]).optional()
})

export const AdminAuditExportRequestSchema = z.object({
  query: AdminAuditLogQuerySchema.omit({ cursor: true, limit: true }).default({}),
  reason: z.string().trim().min(1).max(1000)
})

export const AccessRoleDefinitionSchema = z.object({
  role: z.string(),
  displayName: z.string(),
  description: z.string(),
  kind: z.literal("systemPreset"),
  permissions: z.array(z.string())
})

export const AccessRoleListResponseSchema = z.object({
  roles: z.array(AccessRoleDefinitionSchema),
  catalogVersion: z.string(),
  source: z.string(),
  asOf: z.string()
})

export const AssignUserRolesRequestSchema = z.object({
  groups: z.array(z.string().min(1)).min(1).max(12),
  reason: z.string().min(1).max(1000).refine((value) => value.trim() === value, "reason must not contain surrounding whitespace")
})

export const AliasStatusSchema = z.enum(["draft", "approved", "disabled"])

export const AliasScopeSchema = z.object({
  tenantId: z.string().optional(),
  department: z.string().optional(),
  source: z.string().optional(),
  docType: z.string().optional(),
  benchmarkSuiteId: z.string().optional()
})

export const AliasDefinitionSchema = z.object({
  aliasId: z.string(),
  version: z.string(),
  term: z.string(),
  expansions: z.array(z.string()),
  scope: AliasScopeSchema.optional(),
  status: AliasStatusSchema,
  searchImprovement: z.object({
    candidateSource: z.enum(["human_draft", "ai_suggested", "support_ticket"]),
    sourceQuestionId: z.string().optional(),
    sourceMessageId: z.string().optional(),
    sourceRagRunId: z.string().optional(),
    suggestionReason: z.string().optional(),
    reviewState: z.enum(["pending_review", "reviewed", "published"]),
    reviewReason: z.string().optional(),
    impactSummary: z.string().optional(),
    searchResultDiffSummary: z.string().optional(),
    beforeResultIds: z.array(z.string()).optional(),
    afterResultIds: z.array(z.string()).optional()
  }).optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  reviewComment: z.string().optional(),
  publishedVersion: z.string().optional()
})

export const CreateAliasRequestSchema = z.object({
  term: z.string().min(1).max(120).openapi({ example: "pto" }),
  expansions: z.array(z.string().min(1).max(120)).min(1).max(20).openapi({ example: ["有給休暇", "休暇申請"] }),
  scope: AliasScopeSchema.optional()
})

export const UpdateAliasRequestSchema = CreateAliasRequestSchema.partial().refine(
  (value) => value.term !== undefined || value.expansions !== undefined || value.scope !== undefined,
  "At least one alias field must be provided"
)

export const AliasMutationEvidenceSchema = z.object({
  expectedVersion: z.string().min(1),
  reason: z.string().trim().min(1).max(1000)
})

export const UpdateAliasCommandSchema = UpdateAliasRequestSchema.and(AliasMutationEvidenceSchema)

export const ReviewAliasRequestSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  expectedVersion: z.string().min(1),
  reason: z.string().trim().min(1).max(1000)
})

export const TransitionAliasRequestSchema = z.object({
  targetStatus: z.literal("draft"),
  expectedVersion: z.string().min(1),
  reason: z.string().trim().min(1).max(1000)
})

export const DisableAliasRequestSchema = AliasMutationEvidenceSchema

export const PublishAliasesRequestSchema = z.object({
  expectedVersion: z.string().min(1),
  reason: z.string().trim().min(1).max(1000)
})

export const AliasListResponseSchema = AdminListPageMetadataSchema.extend({
  aliases: z.array(AliasDefinitionSchema)
})

export const AliasListQuerySchema = z.object({
  cursor: AdminPageCursorSchema,
  limit: AdminPageLimitSchema,
  query: AdminListSearchSchema,
  status: AliasStatusSchema.optional(),
  sort: z.enum(["updatedDesc", "termAsc"]).optional()
})

export const AliasAuditLogItemSchema = z.object({
  auditId: z.string(),
  aliasId: z.string().optional(),
  tenantId: z.string(),
  action: z.enum(["create", "update", "review", "transition", "disable", "publish"]),
  actorUserId: z.string(),
  result: z.enum(["success", "denied", "conflict", "failed"]),
  reason: z.string(),
  beforeStatus: AliasStatusSchema.optional(),
  afterStatus: AliasStatusSchema.optional(),
  aliasVersion: z.string().optional(),
  createdAt: z.string(),
  detail: z.string()
})

export const AliasAuditLogResponseSchema = AdminListPageMetadataSchema.extend({
  auditLog: z.array(AliasAuditLogItemSchema)
})

export const AliasAuditLogQuerySchema = z.object({
  cursor: AdminPageCursorSchema,
  limit: AdminPageLimitSchema,
  query: AdminListSearchSchema,
  action: AliasAuditLogItemSchema.shape.action.optional(),
  aliasId: z.string().min(1).max(200).optional()
})

export const PublishAliasesResponseSchema = z.object({
  version: z.string(),
  publishedAt: z.string(),
  aliasCount: z.number().int().nonnegative()
})

export const UsageQuerySchema = z.object({
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  subjectId: z.string().min(1).max(200).optional(),
  runId: z.string().min(1).max(200).optional(),
  modelId: z.string().min(1).max(300).optional(),
  feature: z.string().min(1).max(120).optional(),
  provider: z.string().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().min(1).max(4096).optional()
})

export const UsageQuantitySchema = z.object({
  unit: z.enum(["input_token", "output_token", "cache_read_token", "cache_write_token", "request"]),
  value: z.number().int().nonnegative().optional(),
  source: z.enum(["provider", "tokenizer_estimate", "missing"])
})

export const UsageEventSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string(),
  tenantId: z.string(),
  subjectId: z.string().optional(),
  runId: z.string().optional(),
  feature: z.string().optional(),
  provider: z.string().optional(),
  region: z.string().optional(),
  modelId: z.string().optional(),
  quantities: z.array(UsageQuantitySchema),
  status: z.enum(["succeeded", "failed"]),
  errorCode: z.string().optional(),
  idempotencyKey: z.string(),
  occurredAt: z.string().datetime(),
  recordedAt: z.string().datetime()
})

export const UsageCompletenessSchema = z.object({
  eventCount: z.number().int().nonnegative(),
  actualQuantityCount: z.number().int().nonnegative(),
  estimatedQuantityCount: z.number().int().nonnegative(),
  missingQuantityCount: z.number().int().nonnegative(),
  unknownSubjectCount: z.number().int().nonnegative(),
  unknownRunCount: z.number().int().nonnegative(),
  unknownModelCount: z.number().int().nonnegative(),
  unknownFeatureCount: z.number().int().nonnegative(),
  unpricedQuantityCount: z.number().int().nonnegative(),
  state: z.enum(["complete", "partial", "missing"])
})

const UsageBreakdownSchema = z.object({
  key: z.string(),
  label: z.string(),
  actualQuantity: z.number().nonnegative(),
  estimatedQuantity: z.number().nonnegative(),
  missingQuantityCount: z.number().int().nonnegative(),
  eventCount: z.number().int().nonnegative()
})

const NormalizedUsageQuerySchema = UsageQuerySchema.extend({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  limit: z.number().int().min(1).max(200)
}).omit({ cursor: true })

export const UsageSummaryListResponseSchema = z.object({
  query: NormalizedUsageQuerySchema,
  events: z.array(UsageEventSchema),
  nextCursor: z.string().optional(),
  truncated: z.boolean(),
  asOf: z.string().datetime(),
  source: z.literal("usage_event_store"),
  rolloutMode: z.enum(["disabled", "shadow", "active"]),
  completeness: UsageCompletenessSchema,
  breakdowns: z.object({
    bySubject: z.array(UsageBreakdownSchema),
    byFeature: z.array(UsageBreakdownSchema),
    byProvider: z.array(UsageBreakdownSchema),
    byModel: z.array(UsageBreakdownSchema)
  })
})

export const CostAuditItemSchema = z.object({
  eventId: z.string(),
  subjectId: z.string(),
  runId: z.string(),
  feature: z.string(),
  provider: z.string(),
  region: z.string(),
  modelId: z.string(),
  unit: UsageQuantitySchema.shape.unit,
  quantity: z.number().nonnegative().optional(),
  measurementSource: UsageQuantitySchema.shape.source,
  pricingState: z.enum(["actual", "estimate", "unpriced"]),
  catalogVersion: z.string().optional(),
  priceSource: z.string().optional(),
  unitCostUsd: z.number().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
  occurredAt: z.string().datetime()
})

export const CostAuditSummarySchema = z.object({
  query: NormalizedUsageQuerySchema,
  currency: z.literal("USD"),
  pricedCostUsd: z.number().nonnegative(),
  items: z.array(CostAuditItemSchema),
  nextCursor: z.string().optional(),
  truncated: z.boolean(),
  asOf: z.string().datetime(),
  source: z.literal("usage_event_store+versioned_price_catalog"),
  rolloutMode: z.enum(["disabled", "shadow", "active"]),
  catalogVersions: z.array(z.string()),
  completeness: UsageCompletenessSchema
})

export const UsageExportRequestSchema = z.object({
  query: UsageQuerySchema.omit({ cursor: true, limit: true }),
  reason: z.string().trim().min(1).max(500)
})

const ClarificationContextSchema = z.object({
  originalQuestion: z.string().optional(),
  selectedOptionId: z.string().optional(),
  selectedValue: z.string().optional()
})

const ConversationCitationSchema = z.object({
  documentId: z.string().optional(),
  fileName: z.string().optional(),
  chunkId: z.string().optional(),
  pageStart: z.number().int().positive().optional(),
  pageEnd: z.number().int().positive().optional(),
  pageOrSheet: z.string().optional(),
  drawingNo: z.string().optional(),
  sheetTitle: z.string().optional(),
  scale: z.string().optional(),
  regionId: z.string().optional(),
  regionType: z.string().optional(),
  sourceType: z.string().optional(),
  bbox: MetadataValueSchema.optional(),
  score: z.number().optional(),
  text: z.string().optional()
})

const ConversationTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1).max(4000),
  turnId: z.string().optional(),
  citations: z.array(ConversationCitationSchema).optional(),
  createdAt: z.string().optional()
})

const ConversationHistoryTurnSchema = ConversationTurnSchema.pick({
  role: true,
  text: true,
  turnId: true
})

export const ChatOrchestrationModeSchema = z.enum([
  "rag_answer",
  "support_triage",
  "knowledge_admin_assist",
  "search_improvement_assist",
  "benchmark_assist",
  "debug_assist"
])

export const ChatToolCategorySchema = z.enum([
  "rag",
  "ingest",
  "document",
  "drawing",
  "support",
  "search_improvement",
  "benchmark",
  "debug",
  "admin",
  "external",
  "quality",
  "parse"
])

export const ChatToolDefinitionSchema = z.object({
  toolId: z.string().min(1).openapi({ example: "rag.search" }),
  name: z.string().min(1).openapi({ example: "rag.search" }),
  displayName: z.string().min(1).openapi({ example: "権限内文書検索" }),
  description: z.string().min(1),
  category: ChatToolCategorySchema,
  inputSchema: MetadataValueSchema,
  outputSchema: MetadataValueSchema,
  requiredFeaturePermission: z.string().min(1).openapi({ example: "chat:create" }),
  requiredResourcePermission: z.enum(["readOnly", "full"]).optional(),
  approvalRequired: z.boolean(),
  auditRequired: z.boolean(),
  enabled: z.boolean(),
  disabledReason: z.string().optional(),
  implementationStatus: z.enum(["implemented", "delegated", "placeholder"]),
  orchestrationModes: z.array(ChatOrchestrationModeSchema).default(() => []),
  graphNodeLabels: z.array(z.string()).default(() => []),
  traceLabels: z.array(z.string()).default(() => []),
  maxToolCalls: z.number().int().positive().optional()
})

export const ChatToolInvocationSchema = z.object({
  invocationId: z.string().min(1),
  orchestrationRunId: z.string().min(1),
  toolId: z.string().min(1),
  requesterUserId: z.string().min(1),
  status: z.enum(["queued", "waiting_for_approval", "running", "succeeded", "failed", "cancelled"]),
  input: MetadataValueSchema,
  inputSummary: MetadataValueSchema.optional(),
  output: MetadataValueSchema.optional(),
  outputSummary: MetadataValueSchema.optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional()
})

const ConversationDecontextualizedQuerySchema = z.object({
  originalQuestion: z.string(),
  standaloneQuestion: z.string(),
  retrievalQueries: z.array(z.string()).default(() => []),
  turnDependency: z.string().optional(),
  previousCitationCount: z.number().int().nonnegative().optional()
})

const ConversationCitationMemoryItemSchema = z.object({
  citation: ConversationCitationSchema,
  turnId: z.string().optional(),
  answerExcerpt: z.string().optional(),
  rememberedAt: z.string().optional()
})

const ConversationTaskStateSchema = z.object({
  status: z.enum(["none", "in_progress", "waiting_for_user", "completed", "blocked"]).default("none"),
  goal: z.string().optional(),
  pendingActions: z.array(z.string()).default(() => []),
  metadata: MetadataValueSchema.optional()
})

const ConversationInputSchema = z.object({
  conversationId: z.string(),
  turnId: z.string().optional(),
  turnIndex: z.number().int().nonnegative().optional(),
  turns: z.array(ConversationTurnSchema).default(() => []),
  turnDependency: z.string().optional(),
  state: z.object({
    activeEntities: z.array(z.string()).optional(),
    activeDocuments: z.array(z.string()).optional(),
    activeTopics: z.array(z.string()).optional(),
    constraints: z.array(z.string()).optional()
  }).optional()
})

export const SearchScopeSchema = z.object({
  mode: z.enum(["all", "groups", "documents", "temporary"]).optional(),
  groupIds: z.array(z.string().min(1)).max(20).optional(),
  documentIds: z.array(z.string().min(1)).max(100).optional(),
  includeTemporary: z.boolean().optional(),
  temporaryScopeId: z.string().min(1).optional()
})

export const ChatRequestSchema = z.object({
  question: z.string().min(1).openapi({ example: "経費精算の期限は？" }),
  conversationHistory: z.array(ConversationHistoryTurnSchema).max(20).optional().openapi({
    example: [
      { role: "user", text: "経費精算の期限は？", turnId: "turn-1" },
      { role: "assistant", text: "申請から30日以内です。", turnId: "turn-1:assistant" }
    ]
  }),
  clarificationContext: ClarificationContextSchema.optional(),
  conversation: ConversationInputSchema.optional(),
  modelId: z.string().optional().openapi({ example: "amazon.nova-lite-v1:0" }),
  embeddingModelId: z.string().optional().openapi({ example: "amazon.titan-embed-text-v2:0" }),
  clueModelId: z.string().optional().openapi({ example: "amazon.nova-lite-v1:0" }),
  topK: z.number().int().min(1).max(ragRuntimePolicy.retrieval.maxTopK).optional().openapi({ example: 6 }),
  memoryTopK: z.number().int().min(1).max(ragRuntimePolicy.retrieval.maxMemoryTopK).optional().openapi({ example: 4 }),
  minScore: z.number().min(-1).max(1).optional().openapi({ example: 0.20 }),
  maxIterations: z.number().int().min(1).max(ragRuntimePolicy.retrieval.maxIterations).optional().openapi({ example: 3 }),
  strictGrounded: z.boolean().optional().openapi({ example: true }),
  includeDebug: z.boolean().optional().openapi({ example: false }),
  debug: z.boolean().optional().openapi({ example: false }),
  useMemory: z.boolean().optional().openapi({ example: true }),
  searchScope: SearchScopeSchema.optional()
})

export const SearchRequestSchema = z.object({
  query: z.string().min(1).openapi({ example: "経費精算 承認条件" }),
  topK: z.number().int().min(1).max(ragRuntimePolicy.retrieval.searchRagMaxTopK).optional().openapi({ example: 10 }),
  lexicalTopK: z.number().int().min(0).max(ragRuntimePolicy.retrieval.searchRagMaxSourceTopK).optional().openapi({ example: 80 }),
  semanticTopK: z.number().int().min(0).max(ragRuntimePolicy.retrieval.searchRagMaxSourceTopK).optional().openapi({ example: 80 }),
  embeddingModelId: z.string().optional().openapi({ example: "amazon.titan-embed-text-v2:0" }),
  filters: z.object({
    tenantId: z.string().optional(),
    department: z.string().optional(),
    source: z.string().optional(),
    docType: z.string().optional(),
    benchmarkSuiteId: z.string().optional(),
    documentId: z.string().optional()
  }).optional(),
  scope: SearchScopeSchema.optional()
})

export const BenchmarkSearchRequestSchema = SearchRequestSchema.omit({ filters: true, scope: true }).extend({
  suiteId: z.string().min(1).openapi({ example: "search-standard-v1" })
}).strict()

export const CitationSchema = z.object({
  documentId: z.string(),
  documentVersion: z.string().optional(),
  fileName: z.string(),
  chunkId: z.string().optional(),
  pageStart: z.number().int().positive().optional(),
  pageEnd: z.number().int().positive().optional(),
  pageOrSheet: z.string().optional(),
  drawingNo: z.string().optional(),
  sheetTitle: z.string().optional(),
  scale: z.string().optional(),
  regionId: z.string().optional(),
  regionType: z.string().optional(),
  sourceType: z.string().optional(),
  bbox: MetadataValueSchema.optional(),
  score: z.number(),
  text: z.string(),
  topic: z.string().optional(),
  evidenceRole: z.enum(["supporting", "conflicting", "outdated", "background"]).optional(),
  authorityStatus: z.enum(["authoritative", "secondary", "unknown"]).optional(),
  effectiveFrom: z.string().optional(),
  effectiveUntil: z.string().optional(),
  sourceLocator: z.object({
    page: z.number().int().positive().optional(),
    pageStart: z.number().int().positive().optional(),
    pageEnd: z.number().int().positive().optional(),
    bbox: MetadataValueSchema.optional(),
    unit: z.enum(["normalized_page", "pdf_point", "pixel", "unknown"]).optional(),
    source: z.string().optional(),
    sectionPath: z.array(z.string()).optional(),
    startChar: z.number().int().nonnegative().optional(),
    endChar: z.number().int().nonnegative().optional(),
    sourceBlockId: z.string().optional(),
    sourceChunkIds: z.array(z.string()).optional()
  }).optional(),
  authorizationDecision: z.literal("allowed").optional(),
  authorizationEvaluatedAt: z.string().optional()
})

export const ClarificationOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  resolvedQuery: z.string(),
  reason: z.string().optional(),
  source: z.enum(["memory", "evidence", "aspect", "history"]),
  grounding: z.array(z.object({
    documentId: z.string().optional(),
    fileName: z.string().optional(),
    chunkId: z.string().optional(),
    heading: z.string().optional()
  })).default(() => [])
})

export const ClarificationSchema = z.object({
  needsClarification: z.boolean(),
  reason: z.enum([
    "ambiguous_target",
    "missing_scope",
    "unresolved_reference",
    "multiple_candidate_intents",
    "conflicting_scope",
    "not_needed"
  ]),
  question: z.string(),
  options: z.array(ClarificationOptionSchema).max(ragRuntimePolicy.limits.clarificationOptionLimit),
  missingSlots: z.array(z.string()).default(() => []),
  confidence: z.number().min(0).max(1),
  ambiguityScore: z.number().min(0).max(1).optional(),
  groundedOptionCount: z.number().int().nonnegative().optional()
})

export const DebugStepSchema = z.object({
  id: z.number(),
  label: z.string(),
  status: z.enum(["success", "warning", "error"]),
  latencyMs: z.number(),
  modelId: z.string().optional(),
  summary: z.string(),
  detail: z.string().optional(),
  output: DebugStepOutputSchema.optional(),
  hitCount: z.number().optional(),
  tokenCount: z.number().optional(),
  degradationDecision: SafeDegradationDecisionSchema.optional(),
  startedAt: z.string(),
  completedAt: z.string()
})

export const DebugTraceSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  runId: z.string(),
  requestTraceId: z.string().optional(),
  parentTraceIds: z.array(z.string()).optional(),
  tenantPartitionId: z.string().optional(),
  actorPartitionId: z.string().optional(),
  targetType: DebugTraceTargetTypeSchema.optional().default("rag_run"),
  visibility: DebugTraceVisibilitySchema.optional().default("operator_sanitized"),
  sanitizePolicyVersion: DebugTraceSanitizePolicyVersionSchema.optional().default("debug-trace-sanitize-v1"),
  exportRedaction: z.object({
    policyVersion: DebugTraceSanitizePolicyVersionSchema,
    visibility: DebugTraceVisibilitySchema,
    redactedFields: z.array(z.string()),
    notes: z.array(z.string()).optional()
  }).optional(),
  question: z.string(),
  modelId: z.string(),
  embeddingModelId: z.string(),
  clueModelId: z.string(),
  conversationHistory: z.array(ConversationHistoryTurnSchema).optional(),
  clarificationContext: ClarificationContextSchema.optional(),
  conversation: MetadataValueSchema.optional(),
  conversationState: MetadataValueSchema.optional(),
  decontextualizedQuery: MetadataValueSchema.optional(),
  pipelineVersions: PipelineVersionsSchema.optional(),
  replayVersionManifest: ReplayVersionManifestSchema.optional(),
  decision: ReplayDecisionSchema.optional(),
  ragProfile: RagProfileTraceSchema.optional(),
  topK: z.number(),
  memoryTopK: z.number(),
  minScore: z.number(),
  startedAt: z.string(),
  completedAt: z.string(),
  totalLatencyMs: z.number(),
  status: z.enum(["success", "warning", "error"]),
  answerPreview: z.string(),
  isAnswerable: z.boolean(),
  citations: z.array(CitationSchema),
  retrieved: z.array(CitationSchema),
  finalEvidence: z.array(CitationSchema).optional(),
  toolInvocations: z.array(ChatToolInvocationSchema).optional(),
  steps: z.array(DebugStepSchema)
})

export const ChatResponseSchema = z.object({
  responseType: z.enum(["answer", "refusal", "clarification"]).optional(),
  answer: z.string(),
  isAnswerable: z.boolean(),
  needsClarification: z.boolean().optional(),
  clarification: ClarificationSchema.optional(),
  citations: z.array(CitationSchema),
  retrieved: z.array(CitationSchema),
  finalEvidence: z.array(CitationSchema).optional(),
  debug: DebugTraceSchema.optional()
})

export const ChatRunSchema = z.object({
  runId: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  createdBy: z.string(),
  tenantId: z.string().optional(),
  userEmail: z.string().optional(),
  userGroups: z.array(z.string()).optional(),
  question: z.string(),
  conversationHistory: z.array(ConversationHistoryTurnSchema).optional(),
  clarificationContext: ClarificationContextSchema.optional(),
  modelId: z.string(),
  embeddingModelId: z.string().optional(),
  clueModelId: z.string().optional(),
  topK: z.number().int().positive().optional(),
  memoryTopK: z.number().int().positive().optional(),
  minScore: z.number().optional(),
  strictGrounded: z.boolean().optional(),
  useMemory: z.boolean().optional(),
  maxIterations: z.number().int().positive().optional(),
  includeDebug: z.boolean().optional(),
  responseType: z.enum(["answer", "refusal", "clarification"]).optional(),
  answer: z.string().optional(),
  isAnswerable: z.boolean().optional(),
  needsClarification: z.boolean().optional(),
  clarification: ClarificationSchema.optional(),
  citations: z.array(CitationSchema).optional(),
  retrieved: z.array(CitationSchema).optional(),
  debugRunId: z.string().optional(),
  error: z.string().optional(),
  errorCode: z.enum(["validation_error", "not_found", "permission_revoked", "execution_error"]).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional()
})

export const ChatRunStartResponseSchema = z.object({
  runId: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  eventsPath: z.string()
})

export const SearchResultSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  documentVersion: z.string().optional(),
  fileName: z.string(),
  chunkId: z.string().optional(),
  text: z.string(),
  score: z.number(),
  rrfScore: z.number(),
  lexicalScore: z.number().optional(),
  semanticScore: z.number().optional(),
  lexicalRank: z.number().optional(),
  semanticRank: z.number().optional(),
  matchedTerms: z.array(z.string()),
  sources: z.array(z.enum(["lexical", "semantic"])),
  createdAt: z.string().optional(),
  metadata: z.record(MetadataValueSchema).optional()
})

export const SearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(SearchResultSchema),
  diagnostics: z.object({
    indexVersion: z.string(),
    aliasVersion: z.string(),
    lexicalCount: z.number().int(),
    semanticCount: z.number().int(),
    fusedCount: z.number().int(),
    latencyMs: z.number().int(),
    traceId: z.string(),
    replayVersionManifest: ReplayVersionManifestSchema,
    index: z.object({
      visibleManifestCount: z.number().int().nonnegative(),
      indexedChunkCount: z.number().int().nonnegative(),
      cache: z.enum(["memory", "artifact", "built"]),
      loadMs: z.number().int().nonnegative(),
      degradationDecision: SafeDegradationDecisionSchema.optional()
    }).optional()
  })
})

export const QuestionPrioritySchema = z.enum(["normal", "high", "urgent"])
export const QuestionStatusSchema = z.enum(["open", "in_progress", "waiting_requester", "answered", "resolved"])
export const SupportTicketSourceSchema = z.enum(["manual_escalation", "answer_unavailable", "negative_feedback", "quality_issue"])
export const SupportTicketQualityCauseSchema = z.enum(["retrieval_gap", "low_quality_evidence", "stale_document", "extraction_warning", "unsupported_answer", "other"])
export const SupportSanitizedDiagnosticsSchema = z.object({
  tier: z.literal("support_sanitized"),
  answerUnavailableReason: z.string().optional(),
  retrievalQuality: z.enum(["no_evidence", "insufficient_evidence", "conflicting_evidence", "low_quality_evidence", "unknown"]).optional(),
  qualityCauses: z.array(SupportTicketQualityCauseSchema).optional(),
  visibleCitationIds: z.array(z.string()).optional(),
  visibleDocumentIds: z.array(z.string()).optional(),
  visibleChunkIds: z.array(z.string()).optional(),
  qualityWarnings: z.array(z.string()).optional(),
  suggestedNextActions: z.array(z.enum(["search_improvement_review", "document_owner_review", "document_reparse", "rag_exclusion_review", "benchmark_case_review"])).optional()
})

export const QuestionSchema = z.object({
  questionId: z.string(),
  title: z.string(),
  question: z.string(),
  requesterName: z.string(),
  requesterUserId: z.string().optional(),
  requesterDepartment: z.string(),
  assigneeDepartment: z.string(),
  category: z.string(),
  priority: QuestionPrioritySchema,
  status: QuestionStatusSchema,
  source: SupportTicketSourceSchema.optional(),
  messageId: z.string().optional().openapi({
    description: "チャット発話の安定識別子。同じ認証済み requester と同じ値の再送は同一問い合わせを返します。",
    example: "msg_20260714_001"
  }),
  ragRunId: z.string().optional(),
  answerUnavailableEventId: z.string().optional(),
  answerUnavailableReason: z.string().optional(),
  sanitizedDiagnostics: SupportSanitizedDiagnosticsSchema.optional(),
  assigneeUserId: z.string().optional(),
  assigneeGroupId: z.string().optional(),
  slaDueAt: z.string().optional(),
  qualityCause: SupportTicketQualityCauseSchema.optional(),
  sourceQuestion: z.string().optional(),
  chatAnswer: z.string().optional(),
  chatRunId: z.string().optional(),
  references: z.string().optional(),
  answerTitle: z.string().optional(),
  answerBody: z.string().optional(),
  responderName: z.string().optional(),
  responderDepartment: z.string().optional(),
  internalMemo: z.string().optional(),
  notifyRequester: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  answeredAt: z.string().optional(),
  resolvedAt: z.string().optional()
})

export const QuestionListResponseSchema = z.object({
  questions: z.array(QuestionSchema)
})

export const ConversationMessageSchema = z.object({
  messageId: z.string().optional(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  createdAt: z.string(),
  sourceQuestion: z.string().optional(),
  result: ChatResponseSchema.optional(),
  questionTicket: QuestionSchema.optional()
})

export const ConversationHistoryItemSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]).default(2),
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  updatedAt: z.string(),
  isFavorite: z.boolean().default(false),
  messages: z.array(ConversationMessageSchema).max(100),
  decontextualizedQuery: ConversationDecontextualizedQuerySchema.optional(),
  rollingSummary: z.string().max(4000).optional(),
  queryFocusedSummary: z.string().max(4000).optional(),
  citationMemory: z.array(ConversationCitationMemoryItemSchema).max(50).optional(),
  taskState: ConversationTaskStateSchema.optional(),
  toolInvocations: z.array(ChatToolInvocationSchema).max(100).optional()
})

export const ConversationHistoryListResponseSchema = z.object({
  history: z.array(ConversationHistoryItemSchema)
})

export const FavoriteTargetTypeSchema = z.enum([
  "chatSession",
  "chatMessage",
  "folder",
  "document",
  "agentExecutionPreset",
  "skill",
  "agentProfile",
  "benchmarkRun"
])

export const CreateFavoriteTargetTypeSchema = z.enum([
  "chatSession",
  "folder",
  "document"
])

export const FavoriteSchema = z.object({
  favoriteId: z.string(),
  targetType: FavoriteTargetTypeSchema,
  targetId: z.string(),
  label: z.string().optional(),
  note: z.string().optional(),
  accessible: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

export const FavoriteListResponseSchema = z.object({
  favorites: z.array(FavoriteSchema)
})

export const CreateFavoriteRequestSchema = z.object({
  targetType: CreateFavoriteTargetTypeSchema,
  targetId: z.string().min(1),
  label: z.string().max(200).optional(),
  note: z.string().max(1000).optional()
})

export const CreateQuestionRequestSchema = z.object({
  title: z.string().min(1).max(120).openapi({ example: "山田さんの昼食について確認したい" }),
  question: z.string().min(1).max(2000).openapi({ example: "今日山田さんは何を食べたか、担当者に確認してください。" }),
  requesterName: z.string().optional().openapi({ example: "requester@example.com" }),
  requesterDepartment: z.string().optional().openapi({ example: "総務部" }),
  assigneeDepartment: z.string().optional().openapi({ example: "総務部" }),
  category: z.string().optional().openapi({ example: "その他の質問" }),
  priority: QuestionPrioritySchema.optional(),
  source: SupportTicketSourceSchema.optional().default("manual_escalation"),
  messageId: z.string().trim().min(1).max(200).optional().openapi({
    description: "チャット発話の安定識別子。同じ認証済み requester と同じ値の再送は同一問い合わせを返します。",
    example: "msg_20260714_001"
  }),
  ragRunId: z.string().optional(),
  answerUnavailableEventId: z.string().optional(),
  answerUnavailableReason: z.string().optional(),
  sanitizedDiagnostics: SupportSanitizedDiagnosticsSchema.optional(),
  assigneeUserId: z.string().optional(),
  assigneeGroupId: z.string().optional(),
  slaDueAt: z.string().optional(),
  qualityCause: SupportTicketQualityCauseSchema.optional(),
  sourceQuestion: z.string().optional(),
  chatAnswer: z.string().optional(),
  chatRunId: z.string().optional()
})

export const CreateSearchImprovementCandidateRequestSchema = z.object({
  term: z.string().min(1).max(120).openapi({ example: "休暇申請" }),
  expansions: z.array(z.string().min(1).max(120)).min(1).max(20).openapi({ example: ["年次有給休暇", "有休申請"] }),
  scope: AliasScopeSchema.optional(),
  candidateSource: z.enum(["ai_suggested", "support_ticket"]).optional().default("support_ticket"),
  suggestionReason: z.string().min(1).max(1000).optional(),
  reviewReason: z.string().min(1).max(1000).optional(),
  impactSummary: z.string().max(2000).optional(),
  searchResultDiffSummary: z.string().max(2000).optional(),
  beforeResultIds: z.array(z.string().min(1)).max(50).optional(),
  afterResultIds: z.array(z.string().min(1)).max(50).optional()
})

export const SearchImprovementCandidateResponseSchema = z.object({
  candidate: AliasDefinitionSchema
})

export const AnswerQuestionRequestSchema = z.object({
  answerTitle: z.string().min(1).max(120).openapi({ example: "山田さんの昼食についての回答" }),
  answerBody: z.string().min(1).max(4000).openapi({ example: "山田さんは本日、社内食堂でカレーを食べました。" }),
  responderName: z.string().optional().openapi({ example: "responder@example.com" }),
  responderDepartment: z.string().optional().openapi({ example: "総務部" }),
  references: z.string().optional(),
  internalMemo: z.string().optional(),
  notifyRequester: z.boolean().optional()
})

export const DebugTraceListResponseSchema = z.object({
  debugRuns: z.array(DebugTraceSchema)
})

export const BenchmarkQueryRequestSchema = ChatRequestSchema.omit({ searchScope: true }).extend({
  id: z.string().optional(),
  suiteId: z.string().min(1).openapi({ example: "standard-agent-v1" })
}).strict()

export const BenchmarkQueryResponseSchema = ChatResponseSchema.extend({
  id: z.string().optional()
})

export const BenchmarkModeSchema = z.enum(["agent", "search", "load"])
export const BenchmarkRunnerSchema = z.enum(["codebuild", "lambda"])
export const BenchmarkRunStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "cancelled"])

export const BenchmarkRunThresholdsSchema = z.object({
  answerableAccuracy: z.number().min(0).max(1).optional().openapi({ example: 0.8 }),
  retrievalRecallAt20: z.number().min(0).max(1).optional().openapi({ example: 0.8 }),
  p95LatencyMs: z.number().int().positive().optional().openapi({ example: 15000 })
})

export const BenchmarkRunMetricsSchema = z.object({
  total: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  failedHttp: z.number().int().nonnegative(),
  answerableAccuracy: z.number().nullable().optional(),
  turnAnswerCorrectRate: z.number().nullable().optional(),
  conversationSuccessRate: z.number().nullable().optional(),
  historyDependentAccuracy: z.number().nullable().optional(),
  clarificationNeedPrecision: z.number().nullable().optional(),
  clarificationNeedRecall: z.number().nullable().optional(),
  clarificationNeedF1: z.number().nullable().optional(),
  optionHitRate: z.number().nullable().optional(),
  missingSlotHitRate: z.number().nullable().optional(),
  corpusGroundedOptionRate: z.number().nullable().optional(),
  postClarificationAccuracy: z.number().nullable().optional(),
  overClarificationRate: z.number().nullable().optional(),
  clarificationLatencyOverheadMs: z.number().nullable().optional(),
  postClarificationTaskLatencyMs: z.number().nullable().optional(),
  abstentionRecall: z.number().nullable().optional(),
  abstentionAccuracy: z.number().nullable().optional(),
  citationHitRate: z.number().nullable().optional(),
  expectedFileHitRate: z.number().nullable().optional(),
  extractionAccuracy: z.number().nullable().optional(),
  admissionCorrectness: z.number().nullable().optional(),
  retrievalRecallAt20: z.number().nullable().optional(),
  retrievalRecallAtK: z.number().nullable().optional(),
  falseDenialRate: z.number().nullable().optional(),
  faithfulness: z.number().nullable().optional(),
  unsupportedClaimRate: z.number().nullable().optional(),
  unsupportedSentenceRate: z.number().nullable().optional(),
  unsupportedAnswerRate: z.number().nullable().optional(),
  citationPrecision: z.number().nullable().optional(),
  citationSupportPassRate: z.number().nullable().optional(),
  citationCompleteness: z.number().nullable().optional(),
  citationLocatorValidity: z.number().nullable().optional(),
  requiredClaimMissCount: z.number().int().nonnegative().nullable().optional(),
  falseAnswerRate: z.number().nullable().optional(),
  falseRefusalRate: z.number().nullable().optional(),
  taskCompletionRate: z.number().nullable().optional(),
  taskOutcomeAccuracy: z.number().nullable().optional(),
  criticalTaskFailureCount: z.number().int().nonnegative().nullable().optional(),
  criticalUnsupportedClaimCount: z.number().int().nonnegative().nullable().optional(),
  noAccessLeakCount: z.number().int().nonnegative().nullable().optional(),
  injectionSuccessCount: z.number().int().nonnegative().nullable().optional(),
  secretExposureCount: z.number().int().nonnegative().nullable().optional(),
  eligibilityPropagationP99Ms: z.number().nonnegative().nullable().optional(),
  eligibilityPropagationP50Ms: z.number().nonnegative().nullable().optional(),
  eligibilityPropagationP95Ms: z.number().nonnegative().nullable().optional(),
  eligibilityPropagationMaxMs: z.number().nonnegative().nullable().optional(),
  eligibilityProbeSampleCount: z.number().int().nonnegative().nullable().optional(),
  eligibilityMatrixCoverage: z.number().min(0).max(1).nullable().optional(),
  eligibilityUnreconciledResourceCount: z.number().int().nonnegative().nullable().optional(),
  mttrMs: z.number().nonnegative().nullable().optional(),
  recoveryP95Ms: z.number().nonnegative().nullable().optional(),
  recoveryWithoutLossRate: z.number().min(0).max(1).nullable().optional(),
  recoveryLossCount: z.number().int().nonnegative().nullable().optional(),
  recoveryScenarioCoverage: z.number().min(0).max(1).nullable().optional(),
  recoverySampleCount: z.number().int().nonnegative().nullable().optional(),
  backlogAgeP99Ms: z.number().nonnegative().nullable().optional(),
  backlogAgeSampleCount: z.number().int().nonnegative().nullable().optional(),
  timeoutRate: z.number().min(0).max(1).nullable().optional(),
  retryExhaustionCount: z.number().int().nonnegative().nullable().optional(),
  p50LatencyMs: z.number().nullable().optional(),
  p95LatencyMs: z.number().nullable().optional(),
  p99LatencyMs: z.number().nullable().optional(),
  averageLatencyMs: z.number().nullable().optional(),
  errorRate: z.number().nullable().optional(),
  datasetVersion: z.string().min(1).optional(),
  workloadProfileVersion: z.string().min(1).optional(),
  runtimeProfileVersion: z.string().min(1).optional(),
  priceCatalogVersion: z.string().min(1).optional(),
  indexVersion: z.string().min(1).optional(),
  promptVersion: z.string().min(1).optional(),
  pipelineVersion: z.string().min(1).optional(),
  parserVersion: z.string().min(1).optional(),
  chunkerVersion: z.string().min(1).optional(),
  corpusProfileVersion: z.string().min(1).optional(),
  aclDistributionVersion: z.string().min(1).optional(),
  workloadConcurrency: z.number().int().positive().optional(),
  documentSizeProfileVersion: z.string().min(1).optional(),
  dependencyLatencyProfileVersion: z.string().min(1).optional(),
  qualitySliceMeasurements: z.array(z.object({
    slice: z.string().min(1),
    sampleCount: z.number().int().positive(),
    measurements: z.record(z.string(), z.number())
  }).strict()).optional(),
  eligibilityMatrixReport: z.object({
    schemaVersion: z.literal(1),
    triggerCount: z.number().int().positive(),
    pathCount: z.number().int().positive(),
    probeCount: z.number().int().positive(),
    p50Ms: z.number().nonnegative().optional(),
    p95Ms: z.number().nonnegative().optional(),
    p99Ms: z.number().nonnegative().optional(),
    maxMs: z.number().nonnegative().optional(),
    unreflectedResourceIds: z.array(z.string()),
    probes: z.array(z.object({
      trigger: z.string().min(1),
      path: z.string().min(1),
      propagationMs: z.number().nonnegative().optional(),
      unreflectedResourceIds: z.array(z.string())
    }).strict())
  }).strict().optional(),
  modelCostPerUnit: z.number().nonnegative().nullable().optional(),
  embeddingCostPerUnit: z.number().nonnegative().nullable().optional(),
  storageCostPerUnit: z.number().nonnegative().nullable().optional(),
  workerCostPerUnit: z.number().nonnegative().nullable().optional(),
  egressCostPerUnit: z.number().nonnegative().nullable().optional(),
  totalCostPerUnit: z.number().nonnegative().nullable().optional(),
  costEvidenceSampleCount: z.number().int().nonnegative().nullable().optional(),
  chatCostEvidenceSampleCount: z.number().int().nonnegative().nullable().optional(),
  searchCostEvidenceSampleCount: z.number().int().nonnegative().nullable().optional(),
  ingestCostEvidenceSampleCount: z.number().int().nonnegative().nullable().optional(),
  unitCostKind: z.enum(["chat_request", "search_request", "ingest_document"]).optional(),
  chatCostPerRequest: z.number().nonnegative().nullable().optional(),
  searchCostPerRequest: z.number().nonnegative().nullable().optional(),
  ingestCostPerDocument: z.number().nonnegative().nullable().optional(),
  releaseAuditVersion: z.string().min(1).optional(),
  releaseAuditId: z.string().min(1).optional(),
  datasetSpecificBranchCount: z.number().int().nonnegative().nullable().optional(),
  artifactManifestMismatchCount: z.number().int().nonnegative().nullable().optional()
})

export const BenchmarkRunSchema = z.object({
  runId: z.string(),
  status: BenchmarkRunStatusSchema,
  mode: BenchmarkModeSchema,
  runner: BenchmarkRunnerSchema,
  suiteId: z.string(),
  datasetS3Key: z.string(),
  createdBy: z.string(),
  tenantId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  executionArn: z.string().optional(),
  codeBuildBuildId: z.string().optional(),
  codeBuildLogUrl: z.string().url().optional(),
  codeBuildLogGroupName: z.string().optional(),
  codeBuildLogStreamName: z.string().optional(),
  modelId: z.string().optional(),
  embeddingModelId: z.string().optional(),
  topK: z.number().int().optional(),
  memoryTopK: z.number().int().optional(),
  minScore: z.number().optional(),
  concurrency: z.number().int().optional(),
  thresholds: BenchmarkRunThresholdsSchema.optional(),
  summaryS3Key: z.string().optional(),
  reportS3Key: z.string().optional(),
  resultsS3Key: z.string().optional(),
  metrics: BenchmarkRunMetricsSchema.optional(),
  error: z.string().optional(),
  errorCode: z.enum(["validation_error", "not_found", "permission_revoked", "execution_error"]).optional()
})

export const CreateBenchmarkRunRequestSchema = z.object({
  suiteId: z.string().optional().openapi({ example: "standard-agent-v1" }),
  mode: BenchmarkModeSchema.optional().openapi({ example: "agent" }),
  runner: BenchmarkRunnerSchema.optional().openapi({ example: "codebuild" }),
  modelId: z.string().optional().openapi({ example: "amazon.nova-lite-v1:0" }),
  embeddingModelId: z.string().optional().openapi({ example: "amazon.titan-embed-text-v2:0" }),
  topK: z
    .number()
    .int()
    .min(1)
    .max(Math.max(ragRuntimePolicy.retrieval.maxTopK, ragRuntimePolicy.retrieval.searchRagMaxTopK))
    .optional()
    .openapi({ example: 6 }),
  memoryTopK: z.number().int().min(1).max(ragRuntimePolicy.retrieval.maxMemoryTopK).optional().openapi({ example: 4 }),
  minScore: z.number().min(-1).max(1).optional().openapi({ example: 0.2 }),
  concurrency: z.number().int().min(1).max(20).optional().openapi({ example: 1 }),
  thresholds: BenchmarkRunThresholdsSchema.optional()
})

export const BenchmarkRunListResponseSchema = z.object({
  benchmarkRuns: z.array(BenchmarkRunSchema)
})

export const BenchmarkSuiteSchema = z.object({
  suiteId: z.string(),
  label: z.string(),
  mode: BenchmarkModeSchema,
  datasetS3Key: z.string(),
  preset: z.enum(["smoke", "standard"]),
  defaultConcurrency: z.number().int().positive()
})

export const BenchmarkSuiteListResponseSchema = z.object({
  suites: z.array(BenchmarkSuiteSchema)
})

export const AgentRuntimeProviderSchema = z.enum(["claude_code", "codex", "opencode", "custom"])
export const AgentProviderAvailabilitySchema = z.enum(["disabled", "not_configured", "provider_unavailable", "available"])

export const AgentRuntimeProviderDefinitionSchema = z.object({
  provider: AgentRuntimeProviderSchema,
  displayName: z.string(),
  availability: AgentProviderAvailabilitySchema,
  reason: z.string().optional(),
  configuredModelIds: z.array(z.string())
})

export const AgentModelSelectionSchema = z.object({
  provider: AgentRuntimeProviderSchema,
  modelId: z.string().min(1),
  modelDisplayName: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional()
})

export const AsyncAgentRunStatusSchema = z.enum(["queued", "preparing_workspace", "running", "waiting_for_approval", "completed", "failed", "blocked", "cancelled", "expired"])

export const AgentRunBudgetSchema = z.object({
  maxCost: z.number().nonnegative().optional(),
  maxDurationMinutes: z.number().int().positive().optional(),
  maxToolCalls: z.number().int().positive().optional()
})

export const AgentWorkspaceMountSchema = z.object({
  mountId: z.string(),
  workspaceId: z.string(),
  sourceType: z.enum(["folder", "document", "temporaryUpload", "artifact"]),
  sourceId: z.string(),
  originalFileName: z.string().optional(),
  mountedPath: z.string(),
  accessMode: z.enum(["readOnly", "writableCopy"]),
  permissionCheckedAt: z.string()
})

export const AgentArtifactSchema = z.object({
  artifactId: z.string(),
  agentRunId: z.string(),
  artifactType: z.enum(["file", "patch", "report", "markdown", "json", "log"]),
  fileName: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  storageRef: z.string(),
  createdAt: z.string(),
  writebackStatus: z.enum(["not_requested", "pending_approval", "approved", "rejected", "applied"]).optional(),
  writebackTarget: z.object({
    sourceType: z.enum(["folder", "document"]),
    sourceId: z.string(),
    targetPath: z.string().optional()
  }).optional(),
  writebackRequestedBy: z.string().optional(),
  writebackRequestedAt: z.string().optional(),
  writebackReviewedBy: z.string().optional(),
  writebackReviewedAt: z.string().optional(),
  writebackAppliedBy: z.string().optional(),
  writebackAppliedAt: z.string().optional(),
  writebackDecisionReason: z.string().optional()
})

export const AgentArtifactWritebackRequestSchema = z.object({
  action: z.enum(["request", "approve", "reject", "apply"]),
  target: z.object({
    sourceType: z.enum(["folder", "document"]),
    sourceId: z.string().min(1),
    targetPath: z.string().min(1).max(500).optional()
  }).optional(),
  reason: z.string().max(1000).optional()
})

export const AgentProviderSettingSchema = z.object({
  provider: AgentRuntimeProviderSchema,
  displayName: z.string(),
  availability: AgentProviderAvailabilitySchema,
  credentialMode: z.enum(["environment", "not_configured", "disabled"]),
  configuredModelIds: z.array(z.string()),
  reason: z.string().optional()
})

export const SkillDefinitionSchema = z.object({
  skillId: z.string(),
  tenantId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  folderId: z.string(),
  markdownDocumentId: z.string(),
  version: z.string(),
  status: z.enum(["draft", "active", "archived"]),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const AgentProfileDefinitionSchema = z.object({
  agentProfileId: z.string(),
  tenantId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  folderId: z.string(),
  markdownDocumentId: z.string(),
  defaultSkillIds: z.array(z.string()),
  recommendedProvider: AgentRuntimeProviderSchema.optional(),
  recommendedModelId: z.string().optional(),
  version: z.string(),
  status: z.enum(["draft", "active", "archived"]),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const AgentExecutionPresetSchema = z.object({
  presetId: z.string(),
  ownerUserId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  provider: AgentRuntimeProviderSchema,
  modelId: z.string(),
  defaultFolderIds: z.array(z.string()),
  defaultSkillIds: z.array(z.string()),
  defaultAgentProfileIds: z.array(z.string()),
  defaultBudget: AgentRunBudgetSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const AsyncAgentRunSchema = z.object({
  agentRunId: z.string(),
  runId: z.string(),
  tenantId: z.string(),
  requesterUserId: z.string(),
  requesterEmail: z.string().optional(),
  requesterGroups: z.array(z.string()).optional(),
  provider: AgentRuntimeProviderSchema,
  modelId: z.string(),
  status: AsyncAgentRunStatusSchema,
  providerAvailability: AgentProviderAvailabilitySchema,
  failureReasonCode: z.enum(["not_configured", "provider_unavailable", "cancelled", "permission_revoked", "execution_error"]).optional(),
  failureReason: z.string().optional(),
  instruction: z.string(),
  selectedFolderIds: z.array(z.string()),
  selectedDocumentIds: z.array(z.string()),
  selectedSkillIds: z.array(z.string()),
  selectedAgentProfileIds: z.array(z.string()),
  workspaceId: z.string(),
  workspaceMounts: z.array(AgentWorkspaceMountSchema),
  artifactIds: z.array(z.string()),
  artifacts: z.array(AgentArtifactSchema),
  budget: AgentRunBudgetSchema.optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  updatedAt: z.string()
})

export const CreateAsyncAgentRunRequestSchema = z.object({
  provider: AgentRuntimeProviderSchema,
  modelId: z.string().min(1),
  instruction: z.string().min(1).max(12000),
  selectedFolderIds: z.array(z.string().min(1)).max(50).optional().default([]),
  selectedDocumentIds: z.array(z.string().min(1)).max(100).optional().default([]),
  selectedSkillIds: z.array(z.string().min(1)).max(50).optional().default([]),
  selectedAgentProfileIds: z.array(z.string().min(1)).max(20).optional().default([]),
  budget: AgentRunBudgetSchema.optional()
})

export const AsyncAgentRunListResponseSchema = z.object({
  agentRuns: z.array(AsyncAgentRunSchema)
})

export const AgentArtifactListResponseSchema = z.object({
  artifacts: z.array(AgentArtifactSchema)
})

export const AgentProviderListResponseSchema = z.object({
  providers: z.array(AgentRuntimeProviderDefinitionSchema)
})

export const AgentProviderSettingsResponseSchema = z.object({
  providers: z.array(AgentProviderSettingSchema)
})

export const ChatToolDefinitionListResponseSchema = z.object({
  registryVersion: z.string(),
  tools: z.array(ChatToolDefinitionSchema)
})

export const ChatToolInvocationListResponseSchema = z.object({
  invocations: z.array(ChatToolInvocationSchema)
})

export const QualityActionCardSchema = z.object({
  actionId: z.string(),
  documentId: z.string(),
  fileName: z.string(),
  severity: z.enum(["info", "warning", "blocked"]),
  reasonCodes: z.array(z.string()),
  suggestedAction: z.enum(["review_extraction", "reparse_document", "verify_document", "update_freshness", "rag_exclusion_review"]),
  title: z.string(),
  description: z.string(),
  createdAt: z.string()
})

export const QualityActionCardListResponseSchema = z.object({
  actions: z.array(QualityActionCardSchema)
})

export const AdminExportResponseSchema = z.object({
  exportType: z.enum(["audit_log", "usage_summary", "cost_summary"]),
  url: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
  objectKey: z.string(),
  generatedAt: z.string(),
  redaction: z.object({
    policyVersion: z.string(),
    redactedFields: z.array(z.string()),
    notes: z.array(z.string())
  })
})

export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.record(z.array(z.string())).optional()
})

export const ResourceUnavailableResponseSchema = z.object({
  error: z.literal("Resource unavailable"),
  code: z.literal("RESOURCE_UNAVAILABLE"),
  responseProfileVersion: z.literal("resource-non-enumeration-v1")
})


export const DebugDownloadResponseSchema = z.object({
  url: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
  objectKey: z.string()
})

export const DebugReplayPlanSchema = z.object({
  runId: z.string(),
  targetType: DebugTraceTargetTypeSchema,
  sourceTraceVisibility: DebugTraceVisibilitySchema,
  createdAt: z.string(),
  replayable: z.boolean(),
  versionComplete: z.boolean(),
  blockedReason: z.string().optional(),
  versionManifest: ReplayVersionManifestSchema.optional(),
  inputSummary: z.object({
    question: z.string(),
    modelId: z.string(),
    embeddingModelId: z.string(),
    topK: z.number().int(),
    memoryTopK: z.number().int(),
    minScore: z.number(),
    citationCount: z.number().int().nonnegative()
  }),
  redaction: z.object({
    policyVersion: DebugTraceSanitizePolicyVersionSchema,
    visibility: DebugTraceVisibilitySchema,
    redactedFields: z.array(z.string()),
    notes: z.array(z.string()).optional()
  })
})

export const WorkerTargetTypeSchema = z.enum(["chat_run", "document_ingest_run", "benchmark_run", "async_agent_run"])
export const WorkerEventSchema = z.object({
  runId: z.string().min(1),
  tenantId: z.string().min(1),
  targetType: WorkerTargetTypeSchema.optional()
}).passthrough()

export const WorkerResultSchema = z.object({
  runId: z.string().min(1),
  targetType: WorkerTargetTypeSchema.optional(),
  status: z.string().min(1),
  resultType: z.enum(["succeeded", "failed"]),
  traceId: z.string().optional(),
  replayVersionManifest: ReplayVersionManifestSchema.optional(),
  responseProfileVersion: z.literal("resource-non-enumeration-v1").optional(),
  error: z.object({
    code: z.enum(["validation_error", "not_found", "permission_revoked", "execution_error"]),
    message: z.string(),
    retryable: z.boolean()
  }).optional()
})
