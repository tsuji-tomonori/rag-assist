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
