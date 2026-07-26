# FR-086 administrative-principal resolver conflict report

- base: integration/issue-358-fr086
- attempted commit: 3945619433ffa75dbb0cd82337abf136c0aba449
- generated files and snapshot were resolved in favor of the FR-086 integration root

## Unresolved source files
- `apps/api/src/rag/requirements-coverage.test.ts`
- `apps/api/src/security-mutation-audit-reconciliation-worker.ts`
- `apps/api/src/security/access-control-policy.test.ts`
- `"docs/1_\350\246\201\346\261\202_REQ/11_\350\243\275\345\223\201\350\246\201\346\261\202_PRODUCT/01_\346\251\237\350\203\275\350\246\201\346\261\202_FUNCTIONAL/01_\346\226\207\346\233\270\343\203\273\347\237\245\350\255\230\343\203\231\343\203\274\343\202\271\347\256\241\347\220\206/08_\346\250\251\351\231\220\344\273\230\343\201\215\345\205\261\346\234\211\343\203\273\343\203\251\343\202\244\343\203\225\343\202\265\343\202\244\343\202\257\343\203\253/REQ_FUNCTIONAL_086.md"`
- `infra/lib/memorag-mvp-stack.ts`
- `infra/test/memorag-mvp-stack.test.ts`

## Combined conflict diffs

### `apps/api/src/rag/requirements-coverage.test.ts`

```diff
diff --cc apps/api/src/rag/requirements-coverage.test.ts
index b7e1b6cb,9ceb413d..00000000
--- a/apps/api/src/rag/requirements-coverage.test.ts
+++ b/apps/api/src/rag/requirements-coverage.test.ts
@@@ -89,7 -89,7 +89,11 @@@ const traceByRequirement: Record<string
    "FR-083": ["apps/api/src/rag/_shared/publication/staged-publication-coordinator.ts", "apps/api/src/rag/staged-publication.test.ts"],
    "FR-084": ["apps/api/src/benchmark/evaluation-context.ts", "apps/api/src/benchmark/evaluation-context.test.ts"],
    "FR-085": ["apps/api/src/folders/folder-permission-service.ts", "apps/api/src/documents/document-permission-service.ts", "apps/api/src/folders/folder-permission-service.test.ts", "apps/api/src/documents/document-permission-service.test.ts"],
++<<<<<<< HEAD
 +  "FR-086": ["apps/api/src/security/security-mutation-audit-outbox.ts", "apps/api/src/security/security-mutation-audit-outbox.test.ts", "apps/api/src/security/security-mutation-audit-reconciler.ts", "apps/api/src/security-mutation-audit-reconciliation-worker.test.ts", "apps/api/src/security/resource-group-membership-service.test.ts", "apps/api/src/security/resource-group-membership-audit-reconciler.ts", "apps/api/src/security/resource-group-membership-audit-reconciler.test.ts", "apps/api/src/security/resource-group-update-audit-reconciler.ts", "apps/api/src/security/resource-group-update-audit-reconciler.test.ts", "apps/api/src/security/resource-group-create-audit-reconciler.ts", "apps/api/src/security/resource-group-create-audit-reconciler.test.ts", "apps/api/src/security/resource-group-delete-audit-reconciler.ts", "apps/api/src/security/resource-group-delete-audit-reconciler.test.ts", "apps/api/src/security/application-role-audit-reconciler.ts", "apps/api/src/security/application-role-audit-reconciler.test.ts", "apps/api/src/security/folder-share-audit-reconciler.ts", "apps/api/src/security/folder-share-audit-reconciler.test.ts", "apps/api/src/security/document-share-audit-reconciler.ts", "apps/api/src/security/document-share-audit-reconciler.test.ts", "apps/api/src/security/folder-move-audit-reconciler.ts", "apps/api/src/security/folder-move-audit-reconciler.test.ts", "apps/api/src/folders/folder-archive-service.ts", "apps/api/src/folders/folder-archive-service.test.ts", "apps/api/src/security/folder-delete-audit-reconciler.ts", "apps/api/src/security/folder-delete-audit-reconciler.test.ts", "apps/api/src/security/document-move-audit-reconciler.ts", "apps/api/src/security/document-move-audit-reconciler.test.ts", "apps/api/src/security/document-delete-audit-reconciler.ts", "apps/api/src/security/document-delete-audit-reconciler.test.ts", "apps/api/src/security/security-mutation-audit-quarantine-service.ts", "apps/api/src/security/security-mutation-audit-quarantine-service.test.ts", "apps/api/src/routes/admin-routes.ts", "apps/api/src/rag/offline/pre-retrieval/admission/source-governance-approval-service.test.ts"],
++=======
+   "FR-086": ["apps/api/src/security/security-mutation-audit-outbox.ts", "apps/api/src/security/security-mutation-audit-outbox.test.ts", "apps/api/src/security/security-mutation-audit-reconciler.ts", "apps/api/src/security-mutation-audit-reconciliation-worker.test.ts", "apps/api/src/security/resource-group-membership-service.test.ts", "apps/api/src/security/resource-group-membership-audit-reconciler.ts", "apps/api/src/security/resource-group-membership-audit-reconciler.test.ts", "apps/api/src/security/resource-group-update-audit-reconciler.ts", "apps/api/src/security/resource-group-update-audit-reconciler.test.ts", "apps/api/src/security/resource-group-create-audit-reconciler.ts", "apps/api/src/security/resource-group-create-audit-reconciler.test.ts", "apps/api/src/security/resource-group-delete-audit-reconciler.ts", "apps/api/src/security/resource-group-delete-audit-reconciler.test.ts", "apps/api/src/security/application-role-audit-reconciler.ts", "apps/api/src/security/application-role-audit-reconciler.test.ts", "apps/api/src/security/folder-share-audit-reconciler.ts", "apps/api/src/security/folder-share-audit-reconciler.test.ts", "apps/api/src/security/document-share-audit-reconciler.ts", "apps/api/src/security/document-share-audit-reconciler.test.ts", "apps/api/src/security/folder-move-audit-reconciler.ts", "apps/api/src/security/folder-move-audit-reconciler.test.ts", "apps/api/src/security/folder-delete-audit-reconciler.ts", "apps/api/src/security/folder-delete-audit-reconciler.test.ts", "apps/api/src/security/document-move-audit-reconciler.ts", "apps/api/src/security/document-move-audit-reconciler.test.ts", "apps/api/src/security/administrative-principal-transfer-audit-reconciler.ts", "apps/api/src/security/administrative-principal-transfer-audit-reconciler.test.ts", "apps/api/src/rag/offline/pre-retrieval/admission/source-governance-approval-service.test.ts"],
++>>>>>>> 39456194 (✨ feat(audit): 管理プリンシパル移管の監査復元を追加)
    "FR-087": ["apps/api/src/documents/document-lifecycle-mutation-coordinator.ts", "apps/api/src/folders/folder-lifecycle-mutation-coordinator.ts", "apps/api/src/routes/document-routes.ts", "apps/api/src/rag/memorag-service.ts", "apps/api/src/documents/document-lifecycle-mutation-coordinator.test.ts", "apps/api/src/folders/folder-lifecycle-mutation-coordinator.test.ts", "apps/api/src/folder-move-routes.test.ts", "apps/api/src/rag/memorag-service.test.ts", "apps/api/src/adapters/local-document-group-store.test.ts", "apps/web/src/features/documents/api/documentsApi.ts", "apps/web/src/features/documents/hooks/useDocuments.ts", "apps/web/src/features/documents/components/DocumentWorkspace.tsx", "apps/web/src/features/documents/components/DocumentWorkspace.test.tsx"],
    "FR-088": ["apps/api/src/rag/_shared/security/trace-sanitizer.ts", "apps/api/src/rag/trace-sanitizer.test.ts", "apps/api/src/rag/memorag-service.test.ts"],
    "FR-089": ["apps/api/src/rag/_shared/security/safe-degradation-policy.ts", "apps/api/src/dependencies.ts", "apps/api/src/rag/orchestration/chat-rag-orchestrator.ts", "infra/lib/memorag-mvp-stack.ts", "apps/api/src/rag/safe-degradation-policy.test.ts", "apps/api/src/dependencies.test.ts", "apps/api/src/chat-orchestration/graph.test.ts", "infra/test/memorag-mvp-stack.test.ts"],
```

### `apps/api/src/security-mutation-audit-reconciliation-worker.ts`

```diff
diff --cc apps/api/src/security-mutation-audit-reconciliation-worker.ts
index 0e26fb97,de2fce0a..00000000
--- a/apps/api/src/security-mutation-audit-reconciliation-worker.ts
+++ b/apps/api/src/security-mutation-audit-reconciliation-worker.ts
@@@ -15,7 -15,7 +15,11 @@@ import { DocumentShareAuditAuthoritativ
  import { FolderMoveAuditAuthoritativeResolver } from "./security/folder-move-audit-reconciler.js"
  import { FolderDeleteAuditAuthoritativeResolver } from "./security/folder-delete-audit-reconciler.js"
  import { DocumentMoveAuditAuthoritativeResolver } from "./security/document-move-audit-reconciler.js"
++<<<<<<< HEAD
 +import { DocumentDeleteAuditAuthoritativeResolver } from "./security/document-delete-audit-reconciler.js"
++=======
+ import { AdministrativePrincipalTransferAuditAuthoritativeResolver } from "./security/administrative-principal-transfer-audit-reconciler.js"
++>>>>>>> 39456194 (✨ feat(audit): 管理プリンシパル移管の監査復元を追加)
  
  export type SecurityMutationAuditReconciliationEvent = Readonly<{
    tenantId?: unknown
@@@ -79,8 -79,10 +83,15 @@@ export async function handler
        memberships: deps.groupMembershipStore,
        identities: identityProvider
      }),
++<<<<<<< HEAD
 +    new DocumentDeleteAuditAuthoritativeResolver({
 +      objects: deps.objectStore,
++=======
+     new AdministrativePrincipalTransferAuditAuthoritativeResolver({
+       objects: deps.objectStore,
+       folders: deps.documentGroupStore,
+       resourceGroups: deps.userGroupStore,
++>>>>>>> 39456194 (✨ feat(audit): 管理プリンシパル移管の監査復元を追加)
        localTestIngestAdmissionContext: deps.localTestIngestAdmissionContext,
        legacyGlobalDocumentArtifacts: deps.legacyGlobalDocumentArtifacts
      })
```

### `apps/api/src/security/access-control-policy.test.ts`

```diff
diff --cc apps/api/src/security/access-control-policy.test.ts
index 54a4148d,83c821f4..00000000
--- a/apps/api/src/security/access-control-policy.test.ts
+++ b/apps/api/src/security/access-control-policy.test.ts
@@@ -701,15 -673,15 +701,27 @@@ test("security audit reconciliation wor
    assert.match(documentMoveResolverSource, /manifest_committed/)
    assert.match(documentMoveResolverSource, /rollback_pending/)
    assert.doesNotMatch(documentMoveResolverSource, /putText|putTextIfVersion|\.update\(|\.delete\(|rewriteProjection|cleanupDeletedDocument|register\(/)
++<<<<<<< HEAD
 +  const documentDeleteResolverSource = await readFile(new URL("./document-delete-audit-reconciler.ts", import.meta.url), "utf8")
 +  assert.match(workerSource, /DocumentDeleteAuditAuthoritativeResolver\(\{/)
 +  assert.match(documentDeleteResolverSource, /draft\.targetType === "document"/)
 +  assert.match(documentDeleteResolverSource, /draft\.operation === "revoke\.delete"/)
 +  assert.match(documentDeleteResolverSource, /document-mutations\/delete\/\$\{encodeURIComponent\(tenantId\)\}/)
 +  assert.match(documentDeleteResolverSource, /ObjectStoreRevocationCleanupRepairOutbox/)
 +  assert.match(documentDeleteResolverSource, /ObjectStoreRevocationCleanupCoordinator/)
 +  assert.match(documentDeleteResolverSource, /sourceCleanupWasCheckpointed/)
 +  assert.doesNotMatch(documentDeleteResolverSource, /putText|putTextIfVersion|deleteObject|\.delete\(|cleanupDeletedDocument|\.register\(|markCleanup|markDeny|markAbandoned/)
++=======
+   const transferResolverSource = await readFile(new URL("./administrative-principal-transfer-audit-reconciler.ts", import.meta.url), "utf8")
+   assert.match(workerSource, /AdministrativePrincipalTransferAuditAuthoritativeResolver\(\{/)
+   assert.match(transferResolverSource, /draft\.targetType === "administrativePrincipal"/)
+   assert.match(transferResolverSource, /draft\.operation === "ownership\.transfer"/)
+   assert.match(transferResolverSource, /security\/ownership-transfer\/\$\{encodeURIComponent\(tenantId\)\}/)
+   assert.match(transferResolverSource, /folders\.get\(state\.tenantId, id\)/)
+   assert.match(transferResolverSource, /resourceGroups\.get\(state\.tenantId, id\)/)
+   assert.match(transferResolverSource, /tenantManifestKey\(this\.deps, state\.tenantId, documentId\)/)
+   assert.doesNotMatch(transferResolverSource, /list\(|listKeys|putText|putTextIfVersion|\.update\(|\.delete\(|replace\(|transferBefore/)
++>>>>>>> 39456194 (✨ feat(audit): 管理プリンシパル移管の監査復元を追加)
    assert.match(groupCreateResolverSource, /auditIntentId !== auditIntentId/)
    assert.match(groupCreateResolverSource, /status !== "membership_created"/)
    assert.doesNotMatch(groupCreateResolverSource, /\.create\(|replaceGroupState\(/)
```

### `"docs/1_\350\246\201\346\261\202_REQ/11_\350\243\275\345\223\201\350\246\201\346\261\202_PRODUCT/01_\346\251\237\350\203\275\350\246\201\346\261\202_FUNCTIONAL/01_\346\226\207\346\233\270\343\203\273\347\237\245\350\255\230\343\203\231\343\203\274\343\202\271\347\256\241\347\220\206/08_\346\250\251\351\231\220\344\273\230\343\201\215\345\205\261\346\234\211\343\203\273\343\203\251\343\202\244\343\203\225\343\202\265\343\202\244\343\202\257\343\203\253/REQ_FUNCTIONAL_086.md"`

```diff
```

### `infra/lib/memorag-mvp-stack.ts`

```diff
diff --cc infra/lib/memorag-mvp-stack.ts
index a88370b0,de8fb905..00000000
--- a/infra/lib/memorag-mvp-stack.ts
+++ b/infra/lib/memorag-mvp-stack.ts
@@@ -814,7 -814,7 +814,11 @@@ export class MemoRagMvpStack extends St
          docsBucket.arnForObjects("documents/share-grants.json"),
          docsBucket.arnForObjects("tenant-artifacts/*/folder-mutations/move/*"),
          docsBucket.arnForObjects(`document-mutations/move/${cdk.Aws.ACCOUNT_ID}/*`),
++<<<<<<< HEAD
 +        docsBucket.arnForObjects(`document-mutations/delete/${cdk.Aws.ACCOUNT_ID}/*`),
++=======
+         docsBucket.arnForObjects(`security/ownership-transfer/${cdk.Aws.ACCOUNT_ID}/*`),
++>>>>>>> 39456194 (✨ feat(audit): 管理プリンシパル移管の監査復元を追加)
          docsBucket.arnForObjects("tenant-artifacts/*/manifests/*")
        ]
      }))
```

### `infra/test/memorag-mvp-stack.test.ts`

```diff
diff --cc infra/test/memorag-mvp-stack.test.ts
index 17536587,889f1cac..00000000
--- a/infra/test/memorag-mvp-stack.test.ts
+++ b/infra/test/memorag-mvp-stack.test.ts
@@@ -821,7 -821,7 +821,11 @@@ test("deploys the tenant-scoped securit
    assert.match(policies, /documents\/share-grants/)
    assert.match(policies, /tenant-artifacts\/\*\/folder-mutations\/move\/\*/)
    assert.match(policies, /document-mutations\/move/)
++<<<<<<< HEAD
 +  assert.match(policies, /document-mutations\/delete/)
++=======
+   assert.match(policies, /security\/ownership-transfer/)
++>>>>>>> 39456194 (✨ feat(audit): 管理プリンシパル移管の監査復元を追加)
    assert.match(policies, /tenant-artifacts\/\*\/manifests\/\*/)
    assert.match(policies, /dynamodb:GetItem/)
    assert.match(policies, /dynamodb:Query/)
@@@ -876,23 -876,20 +880,38 @@@
    assert.match(JSON.stringify(documentMoveStatements[0]), /tenant-artifacts.*manifests/)
    assert.doesNotMatch(JSON.stringify(documentMoveStatements[0]), /s3:(?:ListBucket|PutObject|DeleteObject)/)
  
++<<<<<<< HEAD
 +  const documentDeleteStatements = Object.entries(resources)
 +    .filter(([logicalId, resource]) => logicalId.startsWith("SecurityAuditReconciliationFunctionServiceRoleDefaultPolicy") && (resource as any).Type === "AWS::IAM::Policy")
 +    .flatMap(([, resource]) => (resource as any).Properties.PolicyDocument.Statement as any[])
 +    .filter((statement) => JSON.stringify(statement.Resource).includes("document-mutations/delete"))
 +  assert.equal(documentDeleteStatements.length, 1)
 +  assert.equal(documentDeleteStatements[0].Action, "s3:GetObject")
 +  assert.match(JSON.stringify(documentDeleteStatements[0]), /AWS::AccountId/)
 +  assert.match(JSON.stringify(documentDeleteStatements[0]), /security\/revocation-cleanup-repairs/)
 +  assert.match(JSON.stringify(documentDeleteStatements[0]), /security\/revocation-cleanup\//)
 +  assert.match(JSON.stringify(documentDeleteStatements[0]), /tenant-artifacts.*manifests/)
 +  assert.doesNotMatch(JSON.stringify(documentDeleteStatements[0]), /s3:(?:ListBucket|PutObject|DeleteObject)/)
++=======
+   const ownershipTransferStatements = Object.entries(resources)
+     .filter(([logicalId, resource]) => logicalId.startsWith("SecurityAuditReconciliationFunctionServiceRoleDefaultPolicy") && (resource as any).Type === "AWS::IAM::Policy")
+     .flatMap(([, resource]) => (resource as any).Properties.PolicyDocument.Statement as any[])
+     .filter((statement) => JSON.stringify(statement.Resource).includes("security/ownership-transfer"))
+   assert.equal(ownershipTransferStatements.length, 1)
+   assert.equal(ownershipTransferStatements[0].Action, "s3:GetObject")
+   assert.match(JSON.stringify(ownershipTransferStatements[0]), /AWS::AccountId/)
+   assert.doesNotMatch(JSON.stringify(ownershipTransferStatements[0]), /s3:(?:ListBucket|PutObject|DeleteObject)/)
++>>>>>>> 39456194 (✨ feat(audit): 管理プリンシパル移管の監査復元を追加)
  
    const listStatements = Object.entries(resources)
      .filter(([logicalId, resource]) => logicalId.startsWith("SecurityAuditReconciliationFunctionServiceRoleDefaultPolicy") && (resource as any).Type === "AWS::IAM::Policy")
      .flatMap(([, resource]) => (resource as any).Properties.PolicyDocument.Statement as any[])
      .filter((statement) => JSON.stringify(statement.Action).includes("s3:ListBucket"))
++<<<<<<< HEAD
 +  assert.doesNotMatch(JSON.stringify(listStatements), /documents\/share-grants|folder-mutations\/move|document-mutations\/(?:move|delete)|tenant-artifacts.*manifests/)
++=======
+   assert.doesNotMatch(JSON.stringify(listStatements), /documents\/share-grants|folder-mutations\/move|document-mutations\/move|security\/ownership-transfer|tenant-artifacts.*manifests/)
++>>>>>>> 39456194 (✨ feat(audit): 管理プリンシパル移管の監査復元を追加)
  
    const deleteEvidenceStatements = Object.entries(resources)
      .filter(([logicalId, resource]) => logicalId.startsWith("SecurityAuditReconciliationFunctionServiceRoleDefaultPolicy") && (resource as any).Type === "AWS::IAM::Policy")
```
