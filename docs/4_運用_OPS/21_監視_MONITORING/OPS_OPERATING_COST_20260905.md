# 運用費の試算と受入条件

- 状態: 暫定見積もり（東京リージョンの単価再確認待ち）
- 対象: rag-assist の CloudFront / API Gateway / Lambda / Cognito / DynamoDB / S3 Vectors 構成
- 関連: SQ-015、TC-003、FR-019、FR-022、FR-086
- 確認日: 2026-09-05

## 結論

下記の利用量なら、月1,000質問は **約14.29 USD（約2,143円）**、月10,000質問は **約87.67 USD（約13,151円）**を初期予算の参考とする。保管だけのidle例は約2.38 USD（約356円）。1 USD = 150円という予算用仮定、税別、無料枠・クレジット・契約割引控除なし。

これは実請求でも、東京の確定料金でも、上限保証でもない。公開価格の参考値による計算に一律50%の予備費を加えた暫定値である。AWS連携の再認証が必要でPrice List APIを利用できず、東京の全SKUを再確認できていない。現在のdeploy workflowの既定regionはus-east-1、CDKテストはap-northeast-1であり、実際の運用regionは未確定である。正式予算化前に対象アカウントのPrice List / Pricing Calculatorで選択region（東京ならap-northeast-1）を確認し、`tools/operating-cost/estimate.mjs` の単価を置換する。予備費はリージョン差や負荷変動を保証しない。

## 利用量の前提

| 項目/月 | idle | 小規模 | 中規模 |
| --- | ---: | ---: | ---: |
| 質問数 | 0 | 1,000 | 10,000 |
| MAU | 0 | 20 | 100 |
| S3保管GB（文書・抽出結果・監査・成果物・ログ合計） | 10 | 10 | 100 |
| DynamoDB保管GB（全テーブル・索引合計） | 1 | 1 | 10 |
| ベクトル数（memory/evidence合計、各索引10万件以下） | 10,000 | 10,000 | 100,000 |
| 新規文書ページ / ingest jobs | 0 / 0 | 100 / 10 | 1,000 / 100 |
| CloudWatchログGB | 0 | 1 | 10 |
| CloudFront転送GB / Web requests | 0 / 0 | 5 / 20,000 | 50 / 200,000 |
| 参考単価による計算額 USD | 1.58 | 9.52 | 58.45 |
| 50%予備費込み USD | 2.38 | 14.29 | 87.67 |

1質問は、全model call・rewrite・retry・回答を**合算して**入力20,000 / 出力3,000 token、Nova Liteを使用する。単純な「LLMを1回だけ呼ぶ」前提ではない。embeddingは質問300token、新規文書1ページ2,000token。文書の要約生成は1ページ入力2,000 / 出力300tokenを別計上する。実測がこれを上回る場合は比例して増額する。

Lambdaは1質問45.6 GB-s（例: worker 1GB×30秒、SSE 0.5GB×30秒、API 0.5GB×0.2秒×6）、8 invocation。文書は1job 2.9375GB×60秒。APIは1質問6request、Step Functionsは8transition。DynamoDBは1質問400 WRU / 200 RRU（item sizeとGSIを含む仮定）、S3は30write / 100read、vector queryは4回とする。接続時間はMAU×22日×8時間、WS messageは質問×20。

## 固定費・保管費と従量費

- 常時起動EC2、NAT Gateway、ALB、RDS、OpenSearch cluster、Provisioned Throughputは現CDKに存在しない。
- idleでもデータ保管、DynamoDB PITR、4つのCloudWatch alarm、DNS hosted zoneを計上する。空のバケットやLambda関数の個数に固定単価を掛けない。
- 主な変動費はmodel token、Lambda実行時間（SSE待ち時間を含む）、OCRページ、API・DB・object操作、ログ、転送量、MAUである。
- 定期監視・失効cleanup・監査reconciliationの3 scheduleは無効。SQ-015のidleアプリケーションS3 LIST 0/dayと費用優先deployを維持する。対象を明示する監査repairは既定off。

## 参考単価と根拠

参考例の地域は主としてUS East。下記は価格表の仕組み・公開例を確認したうえでの計算入力であり、東京SKUの現行値として認定していない。

| サービス | 計算入力 USD | 確認元 |
| --- | --- | --- |
| Nova Lite | 入力0.06 / 出力0.24、100万tokenあたり | [Amazon Nova料金](https://aws.amazon.com/nova/pricing/) |
| Titan Text Embeddings V2 | 100万tokenあたり0.02 | [AWS公式のモデル説明](https://aws.amazon.com/blogs/machine-learning/get-started-with-amazon-titan-text-embeddings-v2-a-new-state-of-the-art-embeddings-model-on-amazon-bedrock/) |
| Lambda | 0.0000166667 / GB-s、0.20 / 100万request | [Lambda料金](https://aws.amazon.com/lambda/pricing/) |
| API Gateway REST | 3.50 / 100万request | [API Gateway料金](https://aws.amazon.com/api-gateway/pricing/) |
| DynamoDB | 0.625 / 100万WRU、0.125 / 100万RRU、0.25 / GB月、PITR 0.20 / GB月 | [DynamoDB料金](https://aws.amazon.com/dynamodb/pricing/) |
| S3 Standard | 0.023 / GB月、0.005 / 1,000write、0.0004 / 1,000read | [S3料金](https://aws.amazon.com/s3/pricing/) |
| S3 Vectors | 保管0.06 / GB月、upload0.20 / GB、query2.50 / 100万回 + 最初の10万vectorの処理0.004 / TB | [S3 Vectors料金・計算例](https://aws.amazon.com/s3/pricing/) |
| CloudWatch | alarm0.10 / 月、custom metric0.30 / 月、logs0.50 / GB取込、0.03 / GB保管 | [CloudWatch料金](https://aws.amazon.com/cloudwatch/pricing/) |
| CloudFront | 転送0.085 / GB、HTTPS0.01 / 10,000request、Function0.10 / 100万回 | [CloudFront料金](https://aws.amazon.com/cloudfront/pricing/) |
| Cognito | Essentials 0.015 / MAU（無料枠未控除） | [Cognito料金](https://aws.amazon.com/cognito/pricing/) |
| Step Functions | 0.025 / 1,000transition | [Step Functions料金](https://aws.amazon.com/step-functions/pricing/) |
| Textract | DetectDocumentText 0.0015 / page | [Textract料金](https://aws.amazon.com/textract/pricing/) |
| Route 53 / CodeBuild | zone0.50 / 月、Linux small0.005 / 分 | [Route 53料金](https://aws.amazon.com/route53/pricing/)、[CodeBuild料金](https://aws.amazon.com/codebuild/pricing/) |

## 別途増える費用

- ベンチマーク: 定期実行を仮定しない。CodeBuild分数×単価に加え、テストケースのLLM・embedding・API・OCR・ログ・成果物保管を通常利用とは別に計上する。既存CodeBuild最大3時間 / orchestration最大9時間は予算額ではない。
- 高価格モデルへの切替、長い履歴、添付PDF、再索引、エラー時retry、judge評価でtokenと実行時間が増える。モデルを変える際はinput/output別の単価を更新する。
- 非同期外部providerの契約費・実行費、Support契約、ドメイン登録、WAF追加、CloudTrail data events、KMS追加、cross-region転送、replication、バックアップ復元、メール/SMSは未計上。
- 監査365日Object Lock / 400日expiryなどの旧案は未承認であり、自動採用していない。保管期間を長くするとS3、PITR、ログの蓄積量が増える。上表のGBは毎月一定の仮定であり無期限保存の将来費用を表さない。
- 無料枠は他workloadと共有されるため控除しない。Cognito tier、CloudFront契約プラン、税、実為替はアカウントごとに確認する。

## 再計算・運用受入

`node tools/operating-cost/estimate.mjs` で利用量、service別内訳、予備費、円換算をJSON出力する。実環境の7〜14日分のusageと請求を同期間で照合してから月額予算を確定する。idleログ、model合算token、SSE実行秒数、S3/DB request増幅率を重点的に置換する。

初期受入条件は、対象アカウント/region/model/tierの単価確認、想定MAUと質問数のowner確認、保存期間の確定、通知先と月額budgetの設定、実AWSでの認証・同一origin・WebSocket失効・障害復旧の証跡である。AWS Budgetsの通知は支出の強制停止ではない。実deployと請求取得は本PRで実施していない。
