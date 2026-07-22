from pathlib import Path

path = Path("infra/test/memorag-mvp-stack.test.ts")
text = path.read_text()

replacements = [
    (
        '''      RAG_MONITORING_REQUIRED: "1",
      RAG_ALERT_TOPIC_ARN: Match.anyValue()''',
        '''      RAG_MONITORING_REQUIRED: "0",
      RAG_ALERT_TOPIC_ARN: Match.anyValue()'''
    ),
    (
        '''    ScheduleExpression: "rate(1 minute)",
    State: "ENABLED",
    Targets: Match.arrayWith([Match.objectLike({ Input: "{\\"limitPerTenant\\":100}" })])''',
        '''    ScheduleExpression: "rate(1 minute)",
    State: "DISABLED",
    Targets: Match.arrayWith([Match.objectLike({ Input: "{\\"limitPerTenant\\":100}" })])'''
    )
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one match, found {count}: {old!r}")
    text = text.replace(old, new)

path.write_text(text)

contract_path = Path("packages/contract/src/infra.ts")
contract = contract_path.read_text()
old_contract = '  RAG_MONITORING_REQUIRED: "1"'
new_contract = '  RAG_MONITORING_REQUIRED: "0" | "1"'
if contract.count(old_contract) != 1:
    raise SystemExit("RAG monitoring environment contract did not match exactly once")
contract_path.write_text(contract.replace(old_contract, new_contract))
