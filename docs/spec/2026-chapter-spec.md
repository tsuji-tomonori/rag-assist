# 0. 全体方針

## 0.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| rag-assist | ラグアシスト | 文書を安全に検索し、根拠付き回答、問い合わせ、品質改善、ベンチマーク、非同期エージェント実行まで扱う業務支援基盤。 |
| RAG | 検索拡張生成 | 文書検索で見つけた根拠を使ってAIが回答する方式。詳細は「4A. チャット内RAG・回答生成」で定義する。 |
| Async agent | 非同期エージェント | 複数ファイルを扱う長時間作業を、チャットとは別の実行単位で動かす機能。詳細は「4C. 非同期エージェント実行」で定義する。 |
| Feature-level permission | 機能権限 | チャット送信、文書アップロード、ベンチマーク実行など、機能そのものを使えるかを示す権限。 |
| Resource-level permission | リソース権限 | 特定フォルダ、文書、履歴、run、skill、agent profileなど対象物にアクセスできるかを示す権限。 |
| LLM | 大規模言語モデル | 回答生成や判定を行うAIモデル。ただし権限判断や品質判断を単独では任せない。 |

### データ
この章では、データ構造ではなく方針・ルールを中心に整理します。


### 守るべきルール
- すべての操作は、ユーザー状態、機能権限、リソース権限の順に確認する。
- LLMや外部エージェントには、権限外・品質不合格の情報を渡さない。
- 用語は先頭の一括用語集ではなく、各章で登場したタイミングで定義する。
- TypeScript相当のデータ定義はコードではなく表で示し、英名・日本語名・内容を併記する。

### 実行すべき処理
1. 機能領域をチャット、文書管理、品質管理、非同期エージェント、ベンチマーク、運用管理に分ける。
2. 各機能で必要なデータ、ルール、処理、UI、認可を整理する。
3. 実装・運用で迷いやすい用語は、その章の定義表に追加する。

### UI
- 全体管理者が機能領域、権限原則、品質原則を把握できる構成にする。
- 章ごとに「定義」「データ」「守るべきルール」「実行すべき処理」「UI」を確認できるようにする。

------

本仕様書は、全体管理者が運用判断に使えるように、用語を登場する章ごとに定義し、データ定義は表形式で記載します。実装者向けの英名は残しつつ、日本語名と管理上の意味を併記します。

rag-assist の機能は、次の 12 領域に分けます。ここでは領域名だけを示し、各領域の専門用語は該当章の「定義」で説明します。

```text
1. チャット
   - 利用者が閲覧可能な文書に質問し、根拠付き回答や回答不能時の案内を受ける。

2. 非同期エージェント実行
   - チャット回答とは別に、複数ファイルを使う長時間作業や成果物生成を実行する。

3. 履歴・お気に入り
   - 会話、回答、フォルダ、文書、よく使う実行設定を再利用する。

4. ナレッジ管理 / フォルダ管理
   - 文書、フォルダ、共有、検索範囲、再インデックスを管理する。

5. ナレッジ品質 / 高度文書解析
   - 文書を回答根拠として使ってよいか、検証状態、鮮度、抽出品質で判断する。

6. エージェント定義管理
   - エージェントに与える作業手順や役割設定を作成、編集、共有、選択する。

7. 検索改善
   - 利用者の質問語と資料内表現のズレを減らす。

8. 評価・ベンチマーク
   - チャット、回答生成、図面QA、長大PDF、非同期エージェントなどを品質ゲートとして評価する。

9. アカウント・認証・個人設定
   - ログイン、アカウント作成 / 削除、パスワード、個人デフォルト設定を管理する。

10. 管理機能
   - ユーザー、グループ、ロール、監査、コスト、デバッグ、品質ダッシュボードを管理する。

11. API仕様・開発品質ゲート
   - API、画面実装、生成ドキュメントのずれを検出し、リリース前に止める。

12. デプロイ・リリース・ローカル検証
   - 本番環境への反映、運用ワークフロー、開発者向け検証を管理する。
```

このうち、権限設計上もっとも重要なのは次の分離です。

```text
アプリ権限:
その機能を使えるか。
例: チャットできる、ベンチマークを実行できる、非同期エージェントを起動できる、ユーザーを管理できる。

リソース権限:
そのフォルダ・文書・履歴・run・skill・agent profile・品質情報・解析結果にアクセスできるか。
例: Aさん管理 /xxx を読めるか、削除できるか、共有できるか。
```

つまり、すべての操作は原則として次の 2 段階で判定します。

```text
1. Feature-level permission
   その API / 画面 / 操作を使う権限があるか

2. Resource-level permission
   その対象に対して readOnly / full / none のどれか
```

チャット内 RAG、チャット内ツール、非同期エージェントのいずれでも、LLM や外部エージェントに権限判断を任せません。

```text
実行できること =
  ユーザーが active
  + feature permission を持つ
  + 対象 resource に必要な permission を持つ
```

------


## 0.6 データ表の読み方

本文中のデータ定義は、全体管理者が確認しやすいように TypeScript のコード表記ではなく表形式で示します。

| 列 | 意味 |
|---|---|
| 英名 | 実装・API・ログで使う項目名。英数字の識別子として扱う。 |
| 日本語名 | 管理画面、説明、会議資料で使うための読み替え名。 |
| 必須 | データ保存時に必ず必要か、状況に応じて任意かを示す。 |
| 型・値 | 文字列、数値、真偽値、配列、または取りうる値。非技術者は「入力形式・選択肢」と読む。 |
| 内容 | その項目を何のために管理するかの説明。 |

表中の `string` は文字列、`number` は数値、`boolean` ははい/いいえ、`[]` は複数件の一覧を表します。


# 1. 共通概念

## 1.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Tenant | テナント | 組織または契約単位の利用領域。テナントをまたいでデータや権限を共有しない。 |
| User | ユーザー | rag-assistを利用する個人。利用できる機能はロール、閲覧できる資料はフォルダ権限で決まる。 |
| UserGroup | ユーザーグループ | 部署、プロジェクト、チーム、管理者グループなど、複数ユーザーをまとめて扱う単位。 |
| GroupMembership | グループメンバーシップ | ユーザーまたはグループが、別のグループにどの権限で所属しているかを表す関係。 |
| Effective permission | 実効権限 | 個人共有、グループ共有、階層継承をすべて計算した最終権限。 |
| Role | ロール | アプリ上でどの機能を使えるかを決める権限セット。文書閲覧権限とは別に管理する。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| User | ユーザー | ログイン状態、所属ロール、所属グループを管理する。 |
| UserGroup | ユーザーグループ | 部署、プロジェクト、チーム、管理者グループを表す。 |
| GroupMembership | グループメンバーシップ | グループ内のメンバーと権限を表す。 |

### 守るべきルール
- ユーザーは active の場合のみ通常利用できる。
- ロールは機能利用可否を決め、グループはリソース共有の単位として使う。
- グループの入れ子は許可できるが、循環参照は禁止する。
- 実効権限はUI表示、API認可、RAG検索の共通判断に使う。

### 実行すべき処理
1. ユーザーの状態、所属ロール、所属グループを取得する。
2. グループ階層とメンバーシップから実効権限を計算する。
3. 権限変更時は影響範囲を再計算し、監査ログへ記録する。

### UI
- ユーザー一覧、グループ一覧、詳細画面で状態・所属・権限を確認できる。
- 内部グループやシステム用グループは通常利用者向けUIには出さない。

------

## 1.1 ユーザー

### 型定義: `User`（ユーザー）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `User` | ユーザー | rag-assist を利用する人を表す。ログイン状態、所属ロール、所属グループを管理する。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `userId` | ユーザーID | 必須 | `string` | ユーザーIDを一意に識別するためのIDです。 |
| `email` | メールアドレス | 必須 | `string` | このデータで管理する「メールアドレス」です。 |
| `displayName` | 表示名 | 必須 | `string` | このデータで管理する「表示名」です。 |
| `status` | 状態 | 必須 | `"active" / "suspended" / "deleted"` | 対象の現在の状態を示します。 |
| `roleIds` | ロールID一覧 | 必須 | `string[]` | 複数のロールを識別するIDの一覧です。 |
| `groupIds` | グループID一覧 | 必須 | `string[]` | 複数のグループを識別するIDの一覧です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |
| `lastLoginAt` | 最終ログイン日時 | 任意 | `string` | 最終ログイン日時を記録します。 |


ユーザーは、ロールとグループに所属します。

```text
ロール:
アプリ上で何ができるかを決める。

グループ:
どのフォルダや資料にアクセスできるかを決める。
```

------

## 1.2 ユーザーグループ

部署、プロジェクト、任意チーム、システム内部グループはすべて `UserGroup` として扱います。

### 型定義: `UserGroup`（ユーザーグループ）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `UserGroup` | ユーザーグループ | 部署、プロジェクト、チーム、管理者グループなど、複数ユーザーをまとめて扱う単位。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `groupId` | グループID | 必須 | `string` | グループIDを一意に識別するためのIDです。 |
| `name` | 名称 | 必須 | `string` | このデータで管理する「名称」です。 |
| `type` | 種別 | 必須 | `"department" / "project" / "team" / "admin" / "folderPolicy" / "system" / "custom"` | このデータで管理する「種別」です。 |
| `parentGroupId` | 親グループID | 任意 | `string` | 親グループIDを一意に識別するためのIDです。 |
| `ancestorGroupIds` | 祖先グループID一覧 | 必須 | `string[]` | 複数の祖先グループを識別するIDの一覧です。 |
| `status` | 状態 | 必須 | `"active" / "archived"` | 対象の現在の状態を示します。 |
| `createdBy` | 作成者ID | 必須 | `string` | 作成者IDを示します。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


部署もグループの一種として扱えます。

```text
人事部          type=department
経理部          type=department
プロジェクトA    type=project
RAG運用担当     type=admin
フォルダ専用共有  type=folderPolicy
```

`folderPolicy` は内部グループです。UI には原則出しません。

------

## 1.3 グループメンバーシップ

グループ内のユーザーごとに権限を持てます。

### 型定義: `GroupMembership`（グループメンバーシップ）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `GroupMembership` | グループメンバーシップ | ユーザーまたはグループが、別のグループにどの権限で所属しているかを表す。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `groupId` | グループID | 必須 | `string` | グループIDを一意に識別するためのIDです。 |
| `memberType` | メンバー種別 | 必須 | `"user" / "group"` | このデータで管理する「メンバー種別」です。 |
| `memberId` | メンバーID | 必須 | `string` | メンバーIDを一意に識別するためのIDです。 |
| `permissionLevel` | 権限レベル | 必須 | `"full" / "readOnly"` | 操作や対象に必要な権限レベルを示します。 |
| `source` | 発生元 | 必須 | `"manual" / "external" / "system"` | このデータで管理する「発生元」です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


基本ルールは次です。

```text
full:
グループ管理範囲で管理操作できる。

readOnly:
グループ管理範囲を参照できるが、変更はできない。
```

グループの中にグループを入れることは許可してよいですが、循環は禁止します。

```text
禁止:
group_a → group_b → group_a
```

------

# 1A. 認証・アカウント

## 1A.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Account | アカウント | ログイン、パスワード、SSO、MFA、停止・削除状態を管理する単位。ユーザー情報とは分けて扱う。 |
| AuthSession | 認証セッション | ログイン後に発行される利用セッション。期限、失効、最終利用時刻を管理する。 |
| MFA | 多要素認証 | パスワード以外の追加確認により、本人確認を強化する仕組み。 |
| Password reset | パスワード再設定 | パスワードを忘れた利用者が、本人確認後に新しいパスワードを登録する手続き。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| Account | アカウント | 認証方式、状態、メール確認、MFA設定などを管理する。 |
| AuthSession | 認証セッション | ログイン後の利用期限、失効、最終利用時刻を管理する。 |

### 守るべきルール
- アカウント作成、削除、停止、再開は監査対象にする。
- パスワードは十分な長さと複雑性を持たせ、漏えい時に平文で復元できない形式で保存する。
- 削除済み・停止中ユーザーはチャット、文書閲覧、エージェント実行を行えない。
- パスワード再設定では、本人確認とトークン期限を必須にする。

### 実行すべき処理
1. アカウント作成時にメールアドレス、初期ロール、初期グループ、認証方式を登録する。
2. ログイン時に認証情報、アカウント状態、必要なMFAを確認する。
3. パスワード再設定時は一時トークンを発行し、期限内の変更だけを許可する。
4. セッションは期限切れ、明示ログアウト、管理者失効で無効化する。

### UI
- ログイン画面、アカウント作成画面、パスワード再設定画面を用意する。
- 管理者向けにはアカウント停止、再開、削除、MFA状態確認の導線を用意する。

------

## 1A.1 目的

認証・アカウント機能は、rag-assist を利用できる本人性を確認し、アカウントの作成、停止、削除、パスワード再設定を安全に扱うための機能です。

```text
認証:
本人であることを確認する。

認可:
ログイン後に、どの機能・どのリソースを使えるかを確認する。
```

認証に成功しても、resource permission は別途確認します。

------

## 1A.2 アカウントデータ

### 型定義: `Account`（アカウント）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `Account` | アカウント | ログインに使う本人確認情報とアカウント状態を表す。ユーザー情報とは分けて管理する。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `accountId` | アカウントID | 必須 | `string` | アカウントIDを一意に識別するためのIDです。 |
| `tenantId` | テナントID | 必須 | `string` | テナントIDを一意に識別するためのIDです。 |
| `userId` | ユーザーID | 必須 | `string` | ユーザーIDを一意に識別するためのIDです。 |
| `email` | メールアドレス | 必須 | `string` | このデータで管理する「メールアドレス」です。 |
| `emailVerified` | メール確認済み | 必須 | `boolean` | メール確認済みを有効にするか、条件を満たすかを示します。 |
| `authProvider` | 認証方式 | 必須 | `"password" / "sso" / "password_and_sso"` | このデータで管理する「認証方式」です。 |
| `mfaEnabled` | 多要素認証有効 | 必須 | `boolean` | 多要素認証有効を有効にするか、条件を満たすかを示します。 |
| `status` | 状態 | 必須 | `"pending_verification" / "active" / "suspended" / "deletion_requested" / "deleted"` | 対象の現在の状態を示します。 |
| `passwordUpdatedAt` | パスワード更新日時 | 任意 | `string` | パスワード更新日時を記録します。 |
| `lastLoginAt` | 最終ログイン日時 | 任意 | `string` | 最終ログイン日時を記録します。 |
| `failedLoginCount` | ログイン失敗回数 | 必須 | `number` | ログイン失敗回数を数値で管理します。 |
| `lockedUntil` | ロック解除日時 | 任意 | `string` | このデータで管理する「ロック解除日時」です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


`User.status` と `Account.status` は分けます。

```text
Account:
ログインできるか。

User:
アプリ内の主体として active か。
```

------

## 1A.3 アカウント作成

アカウント作成方式は、テナント設定で選択します。

```text
1. 招待制
   管理者がメールアドレスを招待し、利用者が初回パスワードを設定する。

2. セルフサインアップ
   許可されたメールドメインのみ登録可能にする。

3. SSOプロビジョニング
   IdP からの属性または SCIM 等の外部同期により作成する。
```

MVP では招待制を基本にします。
セルフサインアップを許可する場合は、許可ドメイン、メール確認、初期ロール、初期グループを明示設定します。

```text
作成フロー:
1. 管理者または外部IdPが account / user を作成する。
2. 招待メールまたは確認メールを送る。
3. 利用者がメール確認を完了する。
4. 初回パスワードまたは SSO でログインする。
5. 必要に応じて MFA を設定する。
6. 個人設定の初期値を作成する。
```

------

## 1A.4 ログイン

ログイン方式は次をサポートします。

```text
- メールアドレス + パスワード
- SSO
- MFA
```

ログイン時の必須確認:

```text
1. Account.status が active である。
2. User.status が active である。
3. emailVerified が true である。
4. password / SSO / MFA が成功している。
5. lockedUntil が現在時刻より前である。
```

ログイン失敗時は、アカウント有無を示唆しない文言にします。

```text
OK:
メールアドレスまたはパスワードが正しくありません。

NG:
このメールアドレスは登録されていません。
```

------

## 1A.5 パスワード仕様

パスワードは、複雑性ルールよりも長さ、漏洩済みパスワードの拒否、レート制限を重視します。

```text
最小長:
12文字以上

最大長:
128文字以上を受け入れる

必須:
- メールアドレス、表示名、会社名をそのまま含む弱いパスワードを拒否
- よく使われるパスワードを拒否
- 漏洩済みパスワードリストに含まれるものを拒否
- サーバー側では password hash のみ保存
- password reset token は single-use かつ短時間 TTL

非推奨:
- 大文字、小文字、数字、記号をすべて必須にするだけの形式的ルール
- パスワード全文をログ、監査ログ、debug trace に残すこと
```

パスワード変更時:

```text
- 現在のパスワード、または SSO / MFA による再認証を要求する
- 変更後に既存 session を失効するか、利用者に選択させる
- パスワード変更完了通知を送る
```

------

## 1A.6 パスワードを忘れた場合

```text
1. 利用者がメールアドレスを入力する。
2. アカウント有無に関係なく同じ画面メッセージを表示する。
3. 登録済み active account であれば reset link を送る。
4. reset token は single-use、短時間 TTL とする。
5. 新しいパスワードを設定する。
6. 既存 session を失効する。
7. 利用者に通知する。
```

表示文言:

```text
入力されたメールアドレスに該当するアカウントがある場合、再設定用のメールを送信しました。
```

------

## 1A.7 アカウント削除

アカウント削除は、データ所有、監査、共有フォルダへの影響が大きいため危険操作として扱います。

```text
自己削除:
利用者が削除を申請する。
管理者承認が必要なテナントでは deletion_requested にする。

管理者削除:
管理者が対象ユーザーを削除する。
削除前に所有フォルダ、担当 ticket、実行中 run、共有設定への影響を表示する。
```

削除時の扱い:

```text
- Account.status = deleted
- User.status = deleted
- ログイン不可
- 個人情報は保持が必要な監査項目を除き、削除または匿名化する
- 監査ログ、問い合わせ、ベンチマーク run などの整合性に必要な参照は pseudonymous user id に置換できる
- 個人管理フォルダは移譲、archive、または削除を選択する
```

------

## 1A.8 セッション管理

### 型定義: `AuthSession`（認証セッション）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `AuthSession` | 認証セッション | ログイン後に発行される利用セッション。期限、失効、最終利用時刻を管理する。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `sessionId` | セッションID | 必須 | `string` | セッションIDを一意に識別するためのIDです。 |
| `accountId` | アカウントID | 必須 | `string` | アカウントIDを一意に識別するためのIDです。 |
| `userId` | ユーザーID | 必須 | `string` | ユーザーIDを一意に識別するためのIDです。 |
| `status` | 状態 | 必須 | `"active" / "revoked" / "expired"` | 対象の現在の状態を示します。 |
| `issuedAt` | 発行日時 | 必須 | `string` | 発行日時を記録します。 |
| `expiresAt` | 有効期限 | 必須 | `string` | 有効期限を記録します。 |
| `lastSeenAt` | 最終確認日時 | 必須 | `string` | 最終確認日時を記録します。 |
| `ipHash` | IPハッシュ | 任意 | `string` | このデータで管理する「IPハッシュ」です。 |
| `userAgentHash` | ユーザーエージェントハッシュ | 任意 | `string` | このデータで管理する「ユーザーエージェントハッシュ」です。 |


セッション要件:

```text
- 一定期間無操作で session expire
- パスワード変更、MFA解除、アカウント停止時は session revoke
- suspicious login は通知または追加認証
- refresh token / session cookie は HttpOnly / Secure / SameSite を設定
```

------

## 1A.9 認証・アカウントの受け入れ条件

```text
AC-AUTH-001:
ログイン前にアカウント有無を示唆するエラーを出さない。

AC-AUTH-002:
emailVerified=false の account は通常利用できない。

AC-AUTH-003:
パスワード再設定 token は single-use であり、期限切れ後は利用できない。

AC-AUTH-004:
パスワード変更後、利用者へ通知する。

AC-AUTH-005:
アカウント削除前に、所有フォルダ、担当 ticket、実行中 run への影響を表示する。

AC-AUTH-006:
削除済み account はログインできない。

AC-AUTH-007:
認証イベントは監査ログまたはセキュリティログに残る。

AC-AUTH-008:
パスワード、reset token、MFA secret はログや debug trace に出さない。
```

------

# 2. フォルダ管理

## 2.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Folder | フォルダ | 文書の置き場所、共有設定、検索範囲、管理権限の単位。 |
| FolderPolicyGroup | フォルダポリシーグループ | 個人共有を内部的に扱うための非表示グループ。通常UIには出さない。 |
| Canonical path | 正式パス | 管理者配下で一意になるフォルダのフルパス。 |
| Explicit policy | 個別共有設定 | 親フォルダからの共有継承を止め、その階層以降に独自の共有設定を適用すること。 |
| Inheritance | 階層継承 | 子フォルダが親フォルダの共有設定を引き継ぐこと。 |
| readOnly | 閲覧のみ | 閲覧、ダウンロード、RAG参照、citation表示ができる権限。 |
| full | 管理可能 | readOnlyに加え、アップロード、削除、移動、再インデックス、共有変更ができる権限。 |
| none | 権限なし | 対象を見られず、検索対象にも引用にも出ない状態。存在も示唆しない。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| Folder | フォルダ | 管理者、親フォルダ、正式パス、個別共有設定、状態を管理する。 |
| EffectiveFolderPermission | 実効フォルダ権限 | ユーザーが対象フォルダに持つnone/readOnly/fullの最終権限。 |

### 守るべきルール
- フォルダパスは管理者ごとに一意とする。
- 共有設定は子フォルダに継承されるが、子に個別設定があれば子設定を優先する。
- 個別共有設定は親との差分ではなく、その階層以降の完全な共有設定として扱う。
- full権限者が0人になる設定は保存しない。
- 権限外フォルダは一覧、検索、citation、debugの利用者表示に出さない。

### 実行すべき処理
1. フォルダ作成時に管理者、親、名前、正式パスを決める。
2. 共有変更時に個人・グループ・継承関係から実効権限を再計算する。
3. 移動・削除・管理者変更は危険操作として、影響範囲と理由を確認する。

### UI
- フォルダ一覧には管理者、正式パス、状態、自分の権限を表示する。
- 共有設定画面では、親からの継承か個別設定かを明示する。
- 危険操作では差分、影響ユーザー数、影響文書数、理由入力を表示する。

------

## 2.1 フォルダの基本方針

フォルダは、文書の置き場所であり、共有、検索範囲、再インデックス、操作権限の単位です。

```text
フォルダ =
  文書整理の単位
  + RAG検索範囲
  + 共有設定の単位
  + 管理権限の単位
```

フォルダには必ず管理者があります。

```text
管理者:
- 個人
- グループ
```

デフォルトは作成者個人です。

```text
Aさんが個人で作成:
管理者 = Aさん

group_a の配下で作成:
管理者 = group_a
```

------

## 2.2 フォルダデータ

### 型定義: `Folder`（フォルダ）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `Folder` | フォルダ | 文書の置き場所であり、共有設定、検索範囲、管理権限の単位。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `folderId` | フォルダID | 必須 | `string` | フォルダIDを一意に識別するためのIDです。 |
| `tenantId` | テナントID | 必須 | `string` | テナントIDを一意に識別するためのIDです。 |
| `adminPrincipalType` | 管理者主体種別 | 必須 | `"user" / "group"` | このデータで管理する「管理者主体種別」です。 |
| `adminPrincipalId` | 管理者主体ID | 必須 | `string` | 管理者主体IDを一意に識別するためのIDです。 |
| `parentFolderId` | 親フォルダID | 任意 | `string` | 親フォルダIDを一意に識別するためのIDです。 |
| `name` | 名称 | 必須 | `string` | このデータで管理する「名称」です。 |
| `normalizedName` | 正規化名 | 必須 | `string` | このデータで管理する「正規化名」です。 |
| `canonicalPath` | 正式パス | 必須 | `string` | このデータで管理する「正式パス」です。 |
| `normalizedCanonicalPath` | 正規化正式パス | 必須 | `string` | このデータで管理する「正規化正式パス」です。 |
| `hasExplicitPolicy` | 個別共有設定あり | 必須 | `boolean` | 個別共有設定ありを有効にするか、条件を満たすかを示します。 |
| `policyId` | ポリシーID | 任意 | `string` | ポリシーIDを一意に識別するためのIDです。 |
| `status` | 状態 | 必須 | `"active" / "archived"` | 対象の現在の状態を示します。 |
| `createdBy` | 作成者ID | 必須 | `string` | 作成者IDを示します。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


------

## 2.3 パス一意性

フォルダパスは、**管理者ごとに一意**とします。

一意制約は次です。

```text
tenantId
+ adminPrincipalType
+ adminPrincipalId
+ normalizedCanonicalPath
```

つまり、次は重複です。

```text
Aさん /xxx
Aさん /xxx
```

次は重複ではありません。

```text
Aさん /xxx
Aさん /zzz/xxx
```

次も重複ではありません。

```text
Aさん /xxx
Bさん /xxx
```

次も重複ではありません。

```text
group_a /xxx
group_b /xxx
```

重要なのは、**フォルダ名単体では重複判定しない**ことです。

```text
/xxx
/zzz/xxx
```

これは `xxx` という名前が同じでも、フルパスが違うため重複ではありません。

------

## 2.4 フォルダ管理者が個人の場合

管理者が個人の場合、その人は常に `full` です。

```text
Aさん管理 /xxx

Aさん:
full

その他:
共有されていなければ none
```

`full` に含まれる操作は次です。

```text
- RAG参照
- ファイル閲覧
- ダウンロード
- アップロード
- 再インデックス
- 削除
- 移動
- フォルダ名変更
- ファイル名変更
- 共有追加
- 共有削除
- 子フォルダ作成
- 子フォルダの共有設定変更
```

------

## 2.5 フォルダ管理者がグループの場合

管理者がグループの場合、そのグループ内の権限設定に従います。

```text
group_a 管理 /team

group_a:
- 田中: full
- 佐藤: readOnly
```

この場合、

```text
田中:
group_a /team を full で操作可能

佐藤:
group_a /team を readOnly で参照可能
```

------

## 2.6 共有設定

共有は、フォルダを移動したりコピーしたりするものではありません。

```text
共有 =
そのフォルダに対するアクセス権を追加すること
```

共有先は次です。

```text
- 個人
- グループ
```

個人に共有する場合は、内部的にはフォルダ専用グループを透過的に作ります。

```text
Aさん管理 /xxx
  ↓
Bさんに readOnly 共有
```

内部イメージ:

```text
FolderPolicyGroup for Aさん /xxx
  - Aさん: full
  - Bさん: readOnly
```

グループに共有する場合は、そのグループを policy に追加します。

```text
Aさん管理 /xxx
  ↓
group_b に readOnly 共有
```

内部イメージ:

```text
FolderPolicyGroup for Aさん /xxx
  - Aさん: full
  - group_b: readOnly
```

グループのメンバーをフォルダ側にコピーしません。
グループ principal として参照します。

------

## 2.7 グループ共有時の実効権限

グループ内権限とフォルダ共有権限の弱い方を採用します。

```text
実効権限 = min(グループ内権限, フォルダ側の共有権限)
```

例:

```text
group_b:
- 田中: full
- 佐藤: readOnly

Aさん /xxx の共有:
- group_b: full
```

結果:

```text
田中: full
佐藤: readOnly
```

別の例:

```text
group_b:
- 田中: full
- 佐藤: readOnly

Aさん /xxx の共有:
- group_b: readOnly
```

結果:

```text
田中: readOnly
佐藤: readOnly
```

------

## 2.8 同じユーザーが複数経路で権限を持つ場合

同一 policy 内では強い方を採用します。

```text
Aさん /xxx の共有:
- Bさん: full
- group_b: readOnly
```

Bさんが group_b に所属していても、

```text
Bさん = full
```

です。

ただし、階層が異なる場合は、より深い階層の policy が優先されます。

------

## 2.9 階層継承

子フォルダに個別共有設定がない場合、親フォルダの共有設定を継承します。

```text
/group_a
  policy A

/group_a/admin
  共有設定なし

/group_a/team
  共有設定なし
```

この場合、

```text
/group_a/admin → policy A
/group_a/team  → policy A
```

です。

子フォルダに個別共有設定がある場合、その子フォルダ以降では子の設定が優先されます。

```text
/group_a
  policy A

/group_a/admin
  policy B

/group_a/admin/secret
  共有設定なし
```

この場合、

```text
/group_a/admin        → policy B
/group_a/admin/secret → policy B
/group_a/team         → policy A
```

------

## 2.10 個別設定の意味

子フォルダの個別設定は、親との差分ではなく、**このフォルダ以降の完全な共有設定**として扱います。

```text
親:
group_a 全員 full

子:
田中 full
山田 readOnly
```

この場合、子フォルダでは `group_a 全員` は無効です。

```text
/group_a/admin:
田中 full
山田 readOnly
その他 group_a メンバー none
```

これにより、次のような運用ができます。

```text
/group_a/admin だけを特定の人に絞る
/group_a/team は group_a 全体に見せる
```

------

## 2.11 フォルダ移動

同じ管理者内での移動:

```text
Aさん /xxx
  ↓
Aさん /zzz/xxx
```

条件:

```text
- 実行者が元フォルダ full
- 移動先親フォルダ full
- 移動後 canonicalPath が重複しない
```

管理者をまたぐ移動:

```text
Aさん /xxx
  ↓
group_a /xxx
```

これは管理者変更を伴うため、危険操作です。

条件:

```text
- 元フォルダ full
- 移動先グループ側 full
- 移動先に同じ canonicalPath がない
- 移動後の共有設定を確認する
- 監査ログに理由を残す
```

------

## 2.12 フォルダ削除

フォルダ削除は物理削除ではなく archive を基本にします。

```text
status = archived
```

制約:

```text
- 配下文書がある場合は確認必須
- 配下子フォルダがある場合は確認必須
- 削除後は RAG 検索対象外
- 監査ログ必須
```

------

## 2.13 フォルダ管理の受け入れ条件

```text
AC-FOLDER-001:
同じ管理者の /xxx と /xxx は作成できない。

AC-FOLDER-002:
同じ管理者の /xxx と /zzz/xxx は作成できる。

AC-FOLDER-003:
異なる管理者の /xxx と /xxx は作成できる。

AC-FOLDER-004:
フォルダ名変更後の canonicalPath が既存パスと重複する場合は保存できない。

AC-FOLDER-005:
個人管理フォルダでは管理者本人が常に full を持つ。

AC-FOLDER-006:
グループ管理フォルダではグループ内権限に従う。

AC-FOLDER-007:
子フォルダに個別設定がない場合、親の共有設定を継承する。

AC-FOLDER-008:
子フォルダに個別設定がある場合、より深い階層の設定を優先する。

AC-FOLDER-009:
full 権限者が 0 人になる共有設定は保存できない。

AC-FOLDER-010:
共有解除後、再インデックスなしで RAG 検索対象から外れる。
```

------

# 3. 文書管理

## 3.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Document | 文書 | アップロードされたファイルをシステム上で管理する単位。RAG検索や閲覧の対象になる。 |
| Lifecycle status | ライフサイクル状態 | upload、ingest、active、failed、staging、superseded、expired、deletedなど、文書の処理状態。 |
| Metadata | メタデータ | 文書やチャンクに付く補足情報。ページ、表ID、図面番号、品質フラグなどを含む。 |
| Temporary attachment | 一時添付 | 通常フォルダに保存せず、特定チャット内だけで使う添付ファイル。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| Document | 文書 | フォルダ、所有者、ファイル名、MIMEタイプ、ファイルサイズ、ライフサイクル状態を管理する。 |

### 守るべきルール
- active以外の文書は通常のRAG検索対象にしない。
- activeであっても、品質条件やRAG利用可否を満たさなければ回答根拠に使わない。
- 文書操作は所属フォルダの実効権限で制御する。
- 削除は物理削除ではなく論理削除またはarchiveを基本にする。

### 実行すべき処理
1. アップロード先フォルダのfull権限を確認する。
2. ファイル検証後に取り込みrunを作成し、取り込み完了後に文書状態を更新する。
3. 削除、移動、ファイル名変更、再インデックスは監査ログへ記録する。

### UI
- 文書一覧にはタイトル、元ファイル名、フォルダ、状態、更新日時、品質バッジを表示する。
- アップロード完了後に「この資料に質問する」「このフォルダに質問する」「詳細を開く」を表示する。

------

## 3.1 文書データ

### 型定義: `Document`（文書）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `Document` | 文書 | アップロードされたファイルをシステム上で管理する単位。RAG検索や閲覧の対象になる。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `documentId` | 文書ID | 必須 | `string` | 文書IDを一意に識別するためのIDです。 |
| `tenantId` | テナントID | 必須 | `string` | テナントIDを一意に識別するためのIDです。 |
| `folderId` | フォルダID | 必須 | `string` | フォルダIDを一意に識別するためのIDです。 |
| `ownerUserId` | 所有者ユーザーID | 必須 | `string` | 所有者ユーザーIDを一意に識別するためのIDです。 |
| `title` | タイトル | 必須 | `string` | このデータで管理する「タイトル」です。 |
| `originalFileName` | 元ファイル名 | 必須 | `string` | このデータで管理する「元ファイル名」です。 |
| `mimeType` | MIMEタイプ | 必須 | `string` | このデータで管理する「MIMEタイプ」です。 |
| `fileSize` | ファイルサイズ | 必須 | `number` | ファイルサイズを数値で管理します。 |
| `lifecycleStatus` | ライフサイクル状態 | 必須 | `"upload_session_created" / "uploaded" / "ingest_queued" / "ingesting" / "active" / "failed" / "staging" / "superseded" / "expired" / "deleted"` | 対象の現在のライフサイクル状態を示します。 |
| `scopeType` | スコープ種別 | 必須 | `"folder" / "chat" / "benchmark"` | 処理や設定を適用するスコープ種別を示します。 |
| `ingestRunId` | 取り込み実行ID | 任意 | `string` | 取り込み実行IDを一意に識別するためのIDです。 |
| `indexVersion` | インデックスバージョン | 任意 | `string` | 利用したインデックスバージョンを記録し、再実行や差分確認に使います。 |
| `qualityProfileId` | 品質プロファイルID | 任意 | `string` | 品質プロファイルIDを一意に識別するためのIDです。 |
| `parsedDocumentId` | 構造化解析済み文書ID | 任意 | `string` | 構造化解析済み文書IDを一意に識別するためのIDです。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


------

## 3.2 文書ライフサイクル

```text
upload_session_created
  ↓
uploaded
  ↓
ingest_queued
  ↓
ingesting
  ↓
active
```

失敗時:

```text
ingesting
  ↓
failed
```

再インデックス時:

```text
active
  ↓
staging
  ↓
active / superseded
```

`active` は RAG 検索対象になるための必要条件ですが、十分条件ではありません。

```text
active:
取り込み・インデックス登録が完了している。

ragEligible:
現在の品質ポリシー上、RAG回答の根拠として使ってよい。
```

RAG で実際に使える文書は、active であることに加えて、ナレッジ品質と解析品質の条件を満たす必要があります。

```text
RAG回答に使える文書 =
active
+ ragEligibility が許可状態
+ verification / freshness / supersession policy を満たす
+ extraction / OCR / table / figure の解析品質が基準を満たす
+ citation 可能
```

------

## 3.3 文書操作

`readOnly` で可能:

```text
- RAG参照
- ファイル閲覧
- ダウンロード
```

`full` で可能:

```text
- アップロード
- ファイル名変更
- 削除
- 移動
- 再インデックス
- 共有設定変更
```

------

## 3.4 アップロード

アップロード先は必ずフォルダです。

```text
アップロード先:
管理者 / canonicalPath
```

条件:

```text
- 対象フォルダに full
- 文書アップロード機能を使えるアプリ権限
```

アップロード完了後は次の導線を出します。

```text
アップロード完了

[この資料に質問する]
[このフォルダに質問する]
[詳細を開く]
[検索テストする]
[共有設定を確認]
```

------

## 3.5 文書管理の受け入れ条件

```text
AC-DOC-001:
full 権限を持つユーザーは対象フォルダに文書をアップロードできる。

AC-DOC-002:
readOnly ユーザーはアップロードできない。

AC-DOC-003:
active 以外の文書は RAG 検索対象にならない。

AC-DOC-004:
文書削除は確認ダイアログを必須とする。

AC-DOC-005:
文書削除後、RAG 検索対象から即時除外される。

AC-DOC-006:
アップロード完了後に「この資料に質問する」導線が表示される。

AC-DOC-007:
文書一覧には、フォルダ管理者、パス、状態、更新日時を表示する。
```

------

# 3A. 取り込み・抽出・チャンク化

## 3A.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Ingest | 取り込み | ファイル検証、前処理、抽出、チャンク化、embedding、index登録までの流れ。 |
| IngestRun | 取り込み実行 | 文書1件または処理単位ごとの取り込みジョブ。エラー、警告、バージョン、件数を保存する。 |
| Preprocessing | 前処理 | チャンク化前に行うPDF判定、OCR、表抽出、図面変換、ZIP展開など。 |
| Extraction | 抽出 | 元ファイルからテキスト、表、図、ページ、図面情報を取り出すこと。 |
| Chunk | チャンク | 検索と回答生成のために文書を小さく分割した単位。検索単位として使う。 |
| Chunking | チャンク化 | 文書を検索しやすい単位へ分割する処理。 |
| ChunkerConfig | チャンク化設定 | チャンクサイズ、重なり、見出し保持、表分割などの設定。 |
| Embedding | 埋め込み | テキストを意味検索用のベクトルに変換すること。 |
| Vector index | ベクトルインデックス | 意味検索のためにチャンクベクトルを保存する検索基盤。 |
| SourceLocation | 原文位置 | ページ、セル範囲、bbox、レイヤーなど、根拠が元ファイルのどこにあるかを示す情報。 |
| CAD | CAD | DWG、DXF、STEPなどの設計図・3D設計データ。 |
| BIM | BIM | IFC、Revit系ファイルなど、建築情報を構造化して持つモデル。 |
| Drawing metadata | 図面メタデータ | 図面番号、尺度、改訂、レイヤー、ブロック、IFC情報など、図面固有の補足情報。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| IngestRun | 取り込み実行 | 処理状態、対象文書、拡張子、parser/chunker/embeddingバージョン、警告を管理する。 |
| IngestWarning | 取り込み警告 | 品質や回答に影響しうる警告を管理する。 |
| ExtractedDocument | 抽出済み文書 | 抽出テキスト、ページ、表、図、図面情報をまとめる。 |
| FileProfile | ファイルプロファイル | 拡張子、MIMEタイプ、文書種別、OCR要否を示す。 |
| SourceLocation | 原文位置 | ページ、bbox、表、図、図面座標などを示す。 |
| DrawingMetadata | 図面メタデータ | 図面番号、尺度、改訂、レイヤー、ブロック、座標情報を管理する。 |
| DocumentChunk | 文書チャンク | 検索・回答生成に使う分割単位を表す。 |
| ChunkerConfig | チャンク化設定 | 分割方式、サイズ、重なり、表や図面の扱いを定義する。 |
| VectorIndexItem | ベクトルインデックス項目 | チャンクとembedding、検索用metadataを対応づける。 |

### 守るべきルール
- 対象拡張子ごとに前処理、抽出、チャンク化ルールを明記する。
- 検索単位はチャンクだが、認可単位はフォルダまたは文書とする。
- 図面系ファイルはテキスト文書と同じ扱いにせず、図面番号、尺度、レイヤー、座標などを保持する。
- chunk数、原文位置、citation可能性、品質警告を確認し、失敗時はactive化しない。
- chunkerやembedding modelの変更時は再インデックス対象にする。

### 実行すべき処理
1. アップロードファイルの拡張子、MIMEタイプ、サイズ、危険ファイルを検査する。
2. 拡張子別に前処理を実行する。PDFは種別判定、Officeは構造抽出、画像はOCR、図面は図面metadata抽出を行う。
3. 抽出結果を文書構造として保存し、チャンク化ルールに従ってDocumentChunkを作る。
4. embeddingを作成し、VectorIndexItemとしてindex登録する。
5. 取り込み警告、失敗理由、解析バージョンをIngestRunに保存する。

### UI
- 取り込みrun一覧で状態、対象ファイル、処理時間、警告、失敗理由を確認できる。
- 文書詳細で抽出プレビュー、chunkプレビュー、図面metadata、再解析ボタンを表示する。
- 図面系文書では図面番号、改訂、尺度、レイヤー、ブロックなどを専用表示する。

------

## 3A.1 目的

取り込み・抽出・チャンク化は、アップロードされた文書を RAG で安全かつ高品質に参照できる状態へ変換する機能です。

```text
アップロード文書
  ↓
拡張子 / MIME / サイズ / 暗号化状態の検証
  ↓
拡張子別の前処理
  ↓
抽出 / 正規化 / 図面メタデータ抽出
  ↓
チャンク化
  ↓
metadata 付与
  ↓
embedding
  ↓
検索インデックス登録
  ↓
active 化
```

重要なのは、チャンク単位で検索しても、権限判定は必ず文書・フォルダ単位で行うことです。

```text
チャンクは検索単位
フォルダ / 文書は認可単位
```

チャンク化は、拡張子によって前処理、抽出方法、チャンク分割単位、保持すべき metadata が変わります。
MVP では、サポート対象の拡張子と処理方法を明示し、未対応拡張子は取り込み前にエラーにします。

------

## 3A.2 取り込み run

### 型定義: `IngestRun`（取り込み実行）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `IngestRun` | 取り込み実行 | 文書を検証、前処理、抽出、チャンク化、embedding、index登録する一連の処理。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `ingestRunId` | 取り込み実行ID | 必須 | `string` | 取り込み実行IDを一意に識別するためのIDです。 |
| `tenantId` | テナントID | 必須 | `string` | テナントIDを一意に識別するためのIDです。 |
| `documentId` | 文書ID | 必須 | `string` | 文書IDを一意に識別するためのIDです。 |
| `folderId` | フォルダID | 必須 | `string` | フォルダIDを一意に識別するためのIDです。 |
| `status` | 状態 | 必須 | `"queued" / "validating" / "preprocessing" / "extracting" / "chunking" / "embedding" / "indexing" / "completed" / "failed" / "cancelled"` | 対象の現在の状態を示します。 |
| `originalFileName` | 元ファイル名 | 必須 | `string` | このデータで管理する「元ファイル名」です。 |
| `fileExtension` | 拡張子 | 必須 | `string` | このデータで管理する「拡張子」です。 |
| `mimeType` | MIMEタイプ | 必須 | `string` | このデータで管理する「MIMEタイプ」です。 |
| `detectedMimeType` | 検出MIMEタイプ | 任意 | `string` | このデータで管理する「検出MIMEタイプ」です。 |
| `fileSize` | ファイルサイズ | 必須 | `number` | ファイルサイズを数値で管理します。 |
| `extractorVersion` | 抽出器バージョン | 必須 | `string` | 利用した抽出器バージョンを記録し、再実行や差分確認に使います。 |
| `preprocessorVersion` | 前処理バージョン | 必須 | `string` | 利用した前処理バージョンを記録し、再実行や差分確認に使います。 |
| `parserVersion` | 解析器バージョン | 任意 | `string` | 利用した解析器バージョンを記録し、再実行や差分確認に使います。 |
| `ocrEngineVersion` | OCRエンジンバージョン | 任意 | `string` | 利用したOCRエンジンバージョンを記録し、再実行や差分確認に使います。 |
| `layoutModelVersion` | レイアウト解析モデルバージョン | 任意 | `string` | 利用したレイアウト解析モデルバージョンを記録し、再実行や差分確認に使います。 |
| `tableExtractorVersion` | 表抽出器バージョン | 任意 | `string` | 利用した表抽出器バージョンを記録し、再実行や差分確認に使います。 |
| `figureAnalyzerVersion` | 図解析器バージョン | 任意 | `string` | 利用した図解析器バージョンを記録し、再実行や差分確認に使います。 |
| `chunkerVersion` | チャンク化バージョン | 必須 | `string` | 利用したチャンク化バージョンを記録し、再実行や差分確認に使います。 |
| `embeddingModelId` | EmbeddingモデルID | 必須 | `string` | EmbeddingモデルIDを一意に識別するためのIDです。 |
| `indexVersion` | インデックスバージョン | 必須 | `string` | 利用したインデックスバージョンを記録し、再実行や差分確認に使います。 |
| `qualityGateResult` | 品質ゲート結果 | 任意 | `"passed" / "partial" / "failed" / "needs_human_review"` | このデータで管理する「品質ゲート結果」です。 |
| `counters` | 処理件数 | 任意 | `object（主な項目: pageCount, slideCount, sheetCount, drawingSheetCount, tableCount, imageCount, chunkCount, ocrPageCount）` | このデータで管理する「処理件数」です。 |
| `warnings` | 警告一覧 | 任意 | `IngestWarning[]` | 注意が必要な警告一覧を記録します。 |
| `errorCode` | エラーコード | 任意 | `string` | このデータで管理する「エラーコード」です。 |
| `errorMessage` | エラーメッセージ | 任意 | `string` | エラーメッセージとして表示または処理する文字列です。 |
| `createdBy` | 作成者ID | 必須 | `string` | 作成者IDを示します。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |
| `completedAt` | 完了日時 | 任意 | `string` | 完了日時を記録します。 |


### 型定義: `IngestWarning`（取り込み警告）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `IngestWarning` | 取り込み警告 | 取り込み中に発生した注意事項。処理継続はできるが、品質や回答に影響しうる。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `code` | コード | 必須 | `\| "encrypted_file" \| "partial_ocr" \| "unsupported_embedded_object" \| "large_table_split" \| "drawing_converter_unavailable" \| "drawing_metadata_low_confidence" \| "formula_value_mismatch" \| "unknown_encoding" \| ...` | このデータで管理する「コード」です。 |
| `message` | メッセージ | 必須 | `string` | メッセージとして表示または処理する文字列です。 |
| `sourceLocation` | 原文位置 | 任意 | `SourceLocation` | このデータで管理する「原文位置」です。 |


取り込みが `completed` になるまでは、文書は RAG 検索対象にしません。さらに、取り込み完了時には解析品質ゲートを通過させます。

```text
ingest completed
+ document lifecycleStatus = active
+ indexVersion が有効
+ parsedDocument が作成済み
+ chunk / citation / quality gate が合格
```

ただし、品質ゲートに合格して active になっても、DocumentQualityProfile の `ragEligibility` が `excluded` または `restricted` の場合は通常RAG回答には使いません。

------

## 3A.3 対象ファイル拡張子

MVP の取り込み対象は次です。
拡張子は小文字化して判定します。MIME type は補助情報として使いますが、拡張子と MIME が不一致の場合は警告または取り込み失敗にします。

| 区分 | 拡張子 | 取り込み方針 | 主な用途 |
|---|---|---|---|
| PDF | `.pdf` | 標準対応 | 契約書、仕様書、図面PDF、マニュアル |
| Word | `.docx` | 標準対応 | 規程、手順書、議事録 |
| PowerPoint | `.pptx` | 標準対応 | 説明資料、研修資料 |
| Excel | `.xlsx`, `.xls` | 標準対応。ただし `.xls` は変換または互換パーサー経由 | 台帳、一覧、管理表 |
| CSV / TSV | `.csv`, `.tsv` | 標準対応 | マスタ、ログ、一覧データ |
| テキスト | `.txt`, `.md` | 標準対応 | メモ、README、Markdown資料 |
| HTML | `.html`, `.htm` | 標準対応 | Web化されたドキュメント |
| 構造化テキスト | `.json`, `.xml`, `.yaml`, `.yml` | 標準対応。ただし巨大ファイルは record 単位に制限 | 設定、API定義、データ |
| 画像 | `.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`, `.bmp`, `.webp` | OCR 対応 | スキャン文書、写真、画像化された帳票 |
| 図面 / CAD 2D | `.dwg`, `.dxf` | 変換器が設定されている場合に対応。未設定なら取り込み不可 | 建築・設備・製造図面 |
| BIM / CAD 3D | `.ifc`, `.rvt`, `.rfa`, `.step`, `.stp`, `.iges`, `.igs` | 原則 metadata 抽出または IFC / PDF 変換経由。MVP では `.ifc` 優先 | BIM、3D CAD、部材情報 |
| SVG 図面 | `.svg` | XML / テキスト抽出 + 図形 metadata | 構成図、ベクター図 |
| アーカイブ | `.zip` | ZIP 自体はチャンク化しない。内部の許可拡張子だけ展開して取り込み | 複数資料の一括登録 |

非対応拡張子の例:

```text
.exe .dll .bin .iso .mp4 .mov .mp3 .wav .7z .rar
```

非対応ファイルは、次のいずれかにします。

```text
- アップロード時に拒否
- 文書として保存するが、RAG検索対象にはしない
- 管理者が拡張子ポリシーを追加するまで ingest_queued にしない
```

------

## 3A.4 拡張子別の前処理

チャンク化の前に、拡張子ごとに次の前処理を行います。

| 拡張子 | チャンク化前の前処理 | 失敗時の扱い |
|---|---|---|
| `.pdf` | テキストレイヤー有無を判定。ページ分割、回転補正、ページ番号抽出、しおり / アウトライン抽出、画像ページの OCR、表抽出、注釈抽出を行う。図面PDFの場合はタイトルブロック候補と図面枠を抽出する。 | 暗号化・破損時は failed。OCR 一部失敗は警告付きで継続可能。 |
| `.docx` | 段落、見出し style、表、脚注、ヘッダー / フッター、コメント、変更履歴を抽出。変更履歴は既定では承認後テキストとして扱い、コメントは metadata または別 chunk にする。 | style が壊れている場合は paragraph_aware にフォールバック。 |
| `.pptx` | スライド番号、タイトル、本文 shape、speaker notes、表、画像 alt text、グループ化 shape を抽出。読み順を推定する。 | 読み順が不明な shape は警告。スライド単位では継続。 |
| `.xlsx`, `.xls` | workbook / sheet / used range を抽出。結合セル、非表示行列、フィルター、テーブル範囲、数式と表示値、セル書式、ヘッダー候補を抽出する。`.xls` は必要に応じて `.xlsx` 相当へ変換する。 | パスワード付き workbook は failed。巨大 sheet は範囲制限。 |
| `.csv`, `.tsv` | 文字コード判定、区切り文字判定、改行正規化、ヘッダー行推定、列型推定、空行除去を行う。 | 文字コード不明時は警告。区切り文字不明時は failed。 |
| `.txt`, `.md` | 文字コード判定、改行正規化、Markdown 見出し / code block / list / table を抽出する。 | 文字化けが多い場合は failed または警告。 |
| `.html`, `.htm` | script / style / hidden 要素を除外。DOM の見出し階層、table、list、リンク text を抽出。危険 HTML は sanitize する。 | HTML 解析不能時は text fallback。 |
| `.json` | JSON parse、key path 抽出、配列 record 分割、巨大配列の sample / page 化を行う。 | parse 不能時は failed。 |
| `.xml` | XML parse、XPath 抽出、namespace 正規化、繰り返し要素の record 分割を行う。 | parse 不能時は failed。 |
| `.yaml`, `.yml` | YAML parse、key path 抽出、anchor / alias 展開の上限チェックを行う。 | parse 不能時は failed。 |
| `.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`, `.bmp`, `.webp` | EXIF 抽出、向き補正、解像度確認、OCR、領域検出、表領域推定を行う。TIFF はページ単位に分解する。 | OCR 結果が空なら answer_unavailable の原因候補として記録。 |
| `.dwg`, `.dxf` | CAD 変換器で中間形式へ変換。model space / paper space、layout、layer、block、entity、寸法線、注記、タイトルブロック、尺度、単位、図枠を抽出。必要に応じてシート画像をレンダリングし OCR する。 | 変換器未設定なら failed。変換できても metadata 低信頼なら警告。 |
| `.ifc` | IFC entity、GlobalId、IfcProject / IfcSite / IfcBuilding / IfcBuildingStorey、空間、部材、Property Set、分類、材料、数量を抽出。必要に応じて階 / 空間 / 部材種別で集約する。 | IFC parse 不能時は failed。巨大モデルは entity 数を制限。 |
| `.rvt`, `.rfa` | 直接 parse せず、設定済み変換器で `.ifc` または `.pdf` に変換してから処理する。 | 変換器未設定なら failed または RAG非対象。 |
| `.svg` | XML parse、text 要素、title / desc、group、viewBox、id、class、座標、リンクを抽出。 | XML parse 不能時は failed。 |
| `.step`, `.stp`, `.iges`, `.igs` | 3D CAD のメタデータ、部品名、アセンブリ構造、単位、bbox を抽出。本文回答用には metadata chunk 中心にする。 | 変換器未設定なら failed または metadata のみ。 |
| `.zip` | ZIP Slip 対策、展開サイズ上限、ファイル数上限、内部パス検査を行い、許可拡張子のファイルだけ個別 Document として取り込む。 | 危険パス、上限超過、非対応のみの場合は failed。 |

------

## 3A.5 抽出結果

### 型定義: `ExtractedDocument`（抽出済み文書）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ExtractedDocument` | 抽出済み文書 | 元ファイルから抽出したテキスト、ページ、表、図、図面情報などをまとめたもの。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `documentId` | 文書ID | 必須 | `string` | 文書IDを一意に識別するためのIDです。 |
| `ingestRunId` | 取り込み実行ID | 必須 | `string` | 取り込み実行IDを一意に識別するためのIDです。 |
| `text` | テキスト | 必須 | `string` | テキストとして表示または処理する文字列です。 |
| `fileProfile` | ファイルプロファイル | 必須 | `FileProfile` | このデータで管理する「ファイルプロファイル」です。 |
| `pages` | ページ一覧 | 任意 | `object[]（主な項目: page, textStart, textEnd, width, height, rotation）` | このデータで管理する「ページ一覧」です。 |
| `slides` | スライド一覧 | 任意 | `object[]（主な項目: slide, title, textStart, textEnd, notesText）` | このデータで管理する「スライド一覧」です。 |
| `sheets` | シート一覧 | 任意 | `object[]（主な項目: sheetName, usedRange, textStart, textEnd, hidden）` | このデータで管理する「シート一覧」です。 |
| `sections` | セクション一覧 | 任意 | `object[]（主な項目: sectionId, heading, level, textStart, textEnd）` | このデータで管理する「セクション一覧」です。 |
| `tables` | 表一覧 | 任意 | `object[]（主な項目: tableId, sourceLocation, caption, markdown, textStart, textEnd, extractionConfidence）` | このデータで管理する「表一覧」です。 |
| `figures` | 図一覧 | 任意 | `object[]（主な項目: figureId, sourceLocation, caption, generatedDescription, ocrText, ragEligible）` | このデータで管理する「図一覧」です。 |
| `parsedDocumentId` | 構造化解析済み文書ID | 任意 | `string` | 構造化解析済み文書IDを一意に識別するためのIDです。 |
| `drawings` | 図面情報一覧 | 任意 | `DrawingMetadata[]` | このデータで管理する「図面情報一覧」です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |


### 型定義: `FileProfile`（ファイルプロファイル）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `FileProfile` | ファイルプロファイル | 拡張子、MIMEタイプ、PDF/Office/図面などの種別、OCR要否を示す。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `extension` | 拡張子 | 必須 | `string` | このデータで管理する「拡張子」です。 |
| `mimeType` | MIMEタイプ | 必須 | `string` | このデータで管理する「MIMEタイプ」です。 |
| `detectedMimeType` | 検出MIMEタイプ | 任意 | `string` | このデータで管理する「検出MIMEタイプ」です。 |
| `languageHint` | 言語ヒント | 任意 | `"ja" / "en" / "auto"` | このデータで管理する「言語ヒント」です。 |
| `kind` | ファイル種別 | 必須 | `"pdf" / "office_document" / "spreadsheet" / "presentation" / "plain_text" / "structured_text" / "image" / "drawing_2d" / "cad_3d" / "bim" / "archive" / "other"` | このデータで管理する「ファイル種別」です。 |
| `encrypted` | 暗号化有無 | 必須 | `boolean` | 暗号化有無を有効にするか、条件を満たすかを示します。 |
| `hasTextLayer` | テキストレイヤー有無 | 任意 | `boolean` | テキストレイヤー有無を有効にするか、条件を満たすかを示します。 |
| `requiresOcr` | OCR要否 | 任意 | `boolean` | OCR要否を有効にするか、条件を満たすかを示します。 |
| `converterUsed` | 使用変換器 | 任意 | `string` | このデータで管理する「使用変換器」です。 |


### 型定義: `SourceLocation`（原文位置）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `SourceLocation` | 原文位置 | ページ、スライド、セル範囲、図面レイヤー、座標など、根拠が元ファイルのどこにあるかを示す。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `page` | ページ | 任意 | `number` | ページを数値で管理します。 |
| `slide` | スライド | 任意 | `number` | スライドを数値で管理します。 |
| `sheetName` | シート名 | 任意 | `string` | このデータで管理する「シート名」です。 |
| `cellRange` | セル範囲 | 任意 | `string` | このデータで管理する「セル範囲」です。 |
| `layoutName` | レイアウト名 | 任意 | `string` | このデータで管理する「レイアウト名」です。 |
| `layerName` | レイヤー名 | 任意 | `string` | このデータで管理する「レイヤー名」です。 |
| `objectId` | オブジェクトID | 任意 | `string` | オブジェクトIDを一意に識別するためのIDです。 |
| `bbox` | 位置座標 | 任意 | `"px" / "pt" / "mm" / "drawing_unit"` | このデータで管理する「位置座標」です。 |


抽出時には、可能な限り次を保持します。

```text
- ページ番号 / スライド番号 / シート名
- 見出し階層
- 表 / 箇条書き / 注釈
- 原文位置 offset
- ファイル種別
- 抽出エラー / 警告
- OCR 信頼度
- 図面番号、改訂、尺度、単位、レイヤー、ブロック、座標などの図面 metadata
```

citation は、チャンク ID だけでなく、文書名・フォルダ・ページ・見出し・表・図面シートを表示できるようにします。

------

## 3A.6 図面系 metadata

図面系ファイルでは、本文テキストだけではなく、図面固有の metadata を検索・絞り込み・citation に使います。

### 型定義: `DrawingMetadata`（図面メタデータ）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `DrawingMetadata` | 図面メタデータ | 図面番号、改訂、尺度、レイヤー、ブロック、BIM情報など図面特有の管理情報。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `drawingId` | 図面ID | 必須 | `string` | 図面IDを一意に識別するためのIDです。 |
| `sourceLocation` | 原文位置 | 任意 | `SourceLocation` | このデータで管理する「原文位置」です。 |
| `drawingType` | 図面種別 | 必須 | `"architectural" / "structural" / "mechanical" / "electrical" / "civil" / "manufacturing" / "bim" / "unknown"` | このデータで管理する「図面種別」です。 |
| `drawingNumber` | 図面番号 | 任意 | `string` | このデータで管理する「図面番号」です。 |
| `drawingTitle` | 図面名 | 任意 | `string` | このデータで管理する「図面名」です。 |
| `revision` | 改訂 | 任意 | `string` | このデータで管理する「改訂」です。 |
| `issueDate` | 発行日 | 任意 | `string` | このデータで管理する「発行日」です。 |
| `projectName` | プロジェクト名 | 任意 | `string` | このデータで管理する「プロジェクト名」です。 |
| `clientName` | 顧客名 | 任意 | `string` | このデータで管理する「顧客名」です。 |
| `discipline` | 分野 | 任意 | `string` | このデータで管理する「分野」です。 |
| `sheetNumber` | シート番号 | 任意 | `string` | このデータで管理する「シート番号」です。 |
| `sheetTotal` | 総シート数 | 任意 | `string` | このデータで管理する「総シート数」です。 |
| `layoutName` | レイアウト名 | 任意 | `string` | このデータで管理する「レイアウト名」です。 |
| `scale` | 尺度 | 任意 | `string` | このデータで管理する「尺度」です。 |
| `units` | 単位 | 任意 | `string` | このデータで管理する「単位」です。 |
| `coordinateSystem` | 座標系 | 任意 | `string` | このデータで管理する「座標系」です。 |
| `titleBlock` | タイトルブロック | 任意 | `Record<string, string>` | このデータで管理する「タイトルブロック」です。 |
| `layerNames` | レイヤー名一覧 | 任意 | `string[]` | このデータで管理する「レイヤー名一覧」です。 |
| `blockNames` | ブロック名一覧 | 任意 | `string[]` | このデータで管理する「ブロック名一覧」です。 |
| `entityTypes` | エンティティ種別一覧 | 任意 | `string[]` | このデータで管理する「エンティティ種別一覧」です。 |
| `entityCounts` | エンティティ数 | 任意 | `Record<string, number>` | エンティティ数を数値で管理します。 |
| `modelSpace` | モデル空間 | 任意 | `boolean` | モデル空間を有効にするか、条件を満たすかを示します。 |
| `paperSpace` | ペーパー空間 | 任意 | `boolean` | ペーパー空間を有効にするか、条件を満たすかを示します。 |
| `ifc` | IFC情報 | 任意 | `object（主な項目: globalIds, ifcClasses, buildingStoreys, spaces, propertySetNames, materials）` | このデータで管理する「IFC情報」です。 |
| `extractionConfidence` | 抽出信頼度 | 任意 | `number` | 抽出信頼度を数値で管理します。 |


図面 metadata の扱い:

```text
- 図面番号、図面名、改訂、尺度、単位は検索 filter と citation に使う。
- layer / block / entity 情報は、検索改善とデバッグでは表示するが、一般回答では必要な範囲だけ示す。
- 座標や bbox は citation の位置表示、図面ビューアでのハイライト、デバッグに使う。
- metadata だけで回答を断定しない。本文・注記・タイトルブロック等の根拠と組み合わせる。
- 変換器由来の推定値には extractionConfidence を付ける。
```

図面系の主な抽出単位:

| 拡張子 | 抽出単位 | チャンク単位 | citation 表示 |
|---|---|---|---|
| `.pdf` 図面 | ページ、図枠、タイトルブロック、注記、表、寸法文字 | ページ内の注記群、表、タイトルブロック、詳細図単位 | ページ、図面番号、改訂、bbox |
| `.dwg`, `.dxf` | layout、layer、block、entity、注記、寸法線 | layout / layer / block / 注記グループ単位 | layout、layer、図面番号、bbox |
| `.ifc` | project、site、building、storey、space、element、property set | 階、空間、部材種別、property set 単位 | GlobalId、階、空間、部材種別 |
| `.rvt`, `.rfa` | 変換後の IFC / PDF に準拠 | 変換後形式に準拠 | 変換後形式に準拠 |
| `.svg` | text、group、title、desc、viewBox | group / text cluster 単位 | group id、bbox |
| `.step`, `.stp`, `.iges`, `.igs` | assembly、part、property、bbox | assembly / part metadata 単位 | part 名、bbox、単位 |

------

## 3A.7 チャンクデータ

### 型定義: `DocumentChunk`（文書チャンク）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `DocumentChunk` | 文書チャンク | 検索と回答生成に使うため、文書を小さく分割した単位。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `chunkId` | チャンクID | 必須 | `string` | チャンクIDを一意に識別するためのIDです。 |
| `tenantId` | テナントID | 必須 | `string` | テナントIDを一意に識別するためのIDです。 |
| `documentId` | 文書ID | 必須 | `string` | 文書IDを一意に識別するためのIDです。 |
| `folderId` | フォルダID | 必須 | `string` | フォルダIDを一意に識別するためのIDです。 |
| `ingestRunId` | 取り込み実行ID | 必須 | `string` | 取り込み実行IDを一意に識別するためのIDです。 |
| `indexVersion` | インデックスバージョン | 必須 | `string` | 利用したインデックスバージョンを記録し、再実行や差分確認に使います。 |
| `chunkIndex` | チャンク番号 | 必須 | `number` | チャンク番号を数値で管理します。 |
| `chunkKind` | チャンク種別 | 必須 | `"text" / "heading_section" / "table" / "slide" / "spreadsheet_region" / "ocr_region" / "drawing_title_block" / "drawing_annotation" / "drawing_layer_summary" / "bim_entity_group" / "metadata"` | このデータで管理する「チャンク種別」です。 |
| `text` | テキスト | 必須 | `string` | テキストとして表示または処理する文字列です。 |
| `tokenCount` | トークン数 | 必須 | `number` | トークン数を数値で管理します。 |
| `pageStart` | 開始ページ | 任意 | `number` | 開始ページを数値で管理します。 |
| `pageEnd` | 終了ページ | 任意 | `number` | 終了ページを数値で管理します。 |
| `headingPath` | 見出しパス | 任意 | `string[]` | このデータで管理する「見出しパス」です。 |
| `textStart` | テキスト開始位置 | 任意 | `number` | テキスト開始位置を数値で管理します。 |
| `textEnd` | テキスト終了位置 | 任意 | `number` | テキスト終了位置を数値で管理します。 |
| `sourceLocation` | 原文位置 | 任意 | `SourceLocation` | このデータで管理する「原文位置」です。 |
| `drawingMetadata` | 図面メタデータ | 任意 | `DrawingMetadata` | 図面メタデータとして補足情報を保持します。 |
| `metadata` | メタデータ | 必須 | `object（主な項目: documentTitle, originalFileName, fileExtension, mimeType, folderPath, adminPrincipalType, adminPrincipalId, extractionConfidence）` | メタデータとして補足情報を保持します。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |


チャンクには、検索・citation に必要な metadata を持たせます。ただし、権限判定に使う最終情報は、検索インデックス内の metadata だけに依存しません。

```text
検索ヒット後に、manifest / DB 側の folder permission で再確認する。
```

------

## 3A.8 チャンク化設定

### 型定義: `ChunkerConfig`（チャンク化設定）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ChunkerConfig` | チャンク化設定 | チャンクサイズ、重なり、表や図面メタデータの保持など、分割方針を示す。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `chunkerVersion` | チャンク化バージョン | 必須 | `string` | 利用したチャンク化バージョンを記録し、再実行や差分確認に使います。 |
| `strategy` | 戦略 | 必須 | `"fixed_token" / "heading_aware" / "paragraph_aware" / "table_aware" / "slide_aware" / "sheet_aware" / "drawing_aware" / "structured_record_aware" / "hybrid"` | このデータで管理する「戦略」です。 |
| `targetTokens` | 目標トークン数 | 必須 | `number` | 目標トークン数を数値で管理します。 |
| `maxTokens` | 最大トークン数 | 必須 | `number` | 最大トークン数を数値で管理します。 |
| `overlapTokens` | 重なりトークン数 | 必須 | `number` | 重なりトークン数を数値で管理します。 |
| `preserveHeadings` | 見出し保持 | 必須 | `boolean` | 見出し保持を有効にするか、条件を満たすかを示します。 |
| `preserveTables` | 表保持 | 必須 | `boolean` | 表保持を有効にするか、条件を満たすかを示します。 |
| `preserveSlides` | スライド保持 | 必須 | `boolean` | スライド保持を有効にするか、条件を満たすかを示します。 |
| `preserveSheets` | シート保持 | 必須 | `boolean` | シート保持を有効にするか、条件を満たすかを示します。 |
| `preserveDrawingMetadata` | 図面メタデータ保持 | 必須 | `boolean` | 図面メタデータ保持を有効にするか、条件を満たすかを示します。 |
| `splitLongTables` | 長い表の分割 | 必須 | `boolean` | 長い表の分割を有効にするか、条件を満たすかを示します。 |
| `languageHint` | 言語ヒント | 任意 | `"ja" / "en" / "auto"` | このデータで管理する「言語ヒント」です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |


MVP では、次を推奨します。

```text
strategy: hybrid
対象: 見出し / 段落を優先し、長すぎる場合だけ token で分割
overlap: 小さめに設定し、重複 citation を避ける
表: 可能なら markdown 化し、表全体または行グループ単位で chunk 化
図面: タイトルブロック、注記、表、レイヤー要約、部材 metadata を別 chunk として保持
```

------

## 3A.9 拡張子別のチャンク化ルール

| 拡張子 | チャンク化戦略 | 主な分割単位 | 注意点 |
|---|---|---|---|
| `.pdf` | `hybrid` / `page_aware` | 見出し、段落、ページ、表、図面注記 | ページ番号を必ず保持。スキャンPDFは OCR region 単位も保持。 |
| `.docx` | `heading_aware` | 見出し階層、段落、表、脚注 | セクションをまたぐ分割を避ける。 |
| `.pptx` | `slide_aware` | スライド、タイトル、本文、notes、表 | 1 slide = 1 chunk を基本とし、長い notes は分割。 |
| `.xlsx`, `.xls` | `sheet_aware` / `table_aware` | sheet、table range、行グループ、セル範囲 | セル番地、sheet 名、ヘッダーを metadata に保持。数式は表示値と式を分ける。 |
| `.csv`, `.tsv` | `structured_record_aware` | ヘッダー + 行グループ | ヘッダーを各 chunk に付与し、行番号範囲を保持。 |
| `.txt` | `paragraph_aware` | 段落、固定 token | 見出しがない場合は自然段落優先。 |
| `.md` | `heading_aware` | Markdown heading、list、table、code block | code block は分割しない。 |
| `.html`, `.htm` | `heading_aware` | DOM heading、section、table、list | ナビゲーションや footer は除外。 |
| `.json` | `structured_record_aware` | object、array record、key path | key path を chunk metadata に保持。 |
| `.xml` | `structured_record_aware` | XPath、繰り返し要素 | namespace を保持。 |
| `.yaml`, `.yml` | `structured_record_aware` | key path、record | anchor 展開後の path を保持。 |
| 画像拡張子 | `ocr_region` | OCR block、表領域、ページ画像 | OCR confidence と bbox を保持。 |
| `.dwg`, `.dxf` | `drawing_aware` | layout、layer、block、注記、寸法、タイトルブロック | 図面番号、改訂、尺度、単位、layer、bbox を保持。 |
| `.ifc` | `bim_entity_group` | storey、space、element type、property set | GlobalId、IfcClass、階、空間、材料を保持。 |
| `.rvt`, `.rfa` | 変換後形式に準拠 | IFC / PDF の単位 | 変換元ファイル名と変換後ファイルを紐づける。 |
| `.svg` | `drawing_aware` | text group、title、desc、g 要素 | viewBox と bbox を保持。 |
| `.step`, `.stp`, `.iges`, `.igs` | `metadata` / `bim_entity_group` | assembly、part、property | テキスト回答に使える情報が少ない場合は metadata chunk 中心。 |
| `.zip` | なし | 内部ファイルを個別に処理 | ZIP 自体は RAG chunk を作らない。 |

------

## 3A.10 共通チャンク化ルール

```text
- 見出しをまたぐ分割をできるだけ避ける
- ページ番号、スライド番号、シート名、セル範囲、図面 layout を失わない
- 表はセルの意味が壊れない単位で分割する
- 参照条文、手順、FAQ は 1 chunk 内で完結しやすくする
- 図面のタイトルブロックと一般注記は別 chunk として検索できるようにする
- BIM / CAD の entity は、個別 entity で細かくしすぎず、階・空間・種別で集約する
- overlap は検索 recall のために使うが、回答生成時に重複根拠を除去する
- チャンク本文に権限情報や内部 policy 情報を混ぜない
```

文書が短い場合は、無理に細かく分割しません。

```text
短文書:
1 document = 1 chunk でもよい
```

------

## 3A.11 embedding と index item

### 型定義: `VectorIndexItem`（ベクトルインデックス項目）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `VectorIndexItem` | ベクトルインデックス項目 | チャンクを意味検索できるようにした検索インデックス上の項目。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `chunkId` | チャンクID | 必須 | `string` | チャンクIDを一意に識別するためのIDです。 |
| `tenantId` | テナントID | 必須 | `string` | テナントIDを一意に識別するためのIDです。 |
| `documentId` | 文書ID | 必須 | `string` | 文書IDを一意に識別するためのIDです。 |
| `folderId` | フォルダID | 必須 | `string` | フォルダIDを一意に識別するためのIDです。 |
| `indexVersion` | インデックスバージョン | 必須 | `string` | 利用したインデックスバージョンを記録し、再実行や差分確認に使います。 |
| `embeddingModelId` | EmbeddingモデルID | 必須 | `string` | EmbeddingモデルIDを一意に識別するためのIDです。 |
| `vector` | ベクトル | 必須 | `number[]` | ベクトルを数値で管理します。 |
| `searchableText` | 検索用テキスト | 必須 | `string` | 検索用テキストとして表示または処理する文字列です。 |
| `metadata` | メタデータ | 必須 | `object（主な項目: lifecycleStatus, mimeType, fileExtension, chunkKind, pageStart, pageEnd, slide, sheetName）` | メタデータとして補足情報を保持します。 |


ベクトル検索の対象は、次で制限します。

```text
tenantId
+ indexVersion
+ document lifecycleStatus = active
+ authorized folderIds
```

ただし、検索エンジン側の filter だけで認可を完結させません。検索後にも必ず再確認します。

------

## 3A.12 チャンク化と再インデックス

次の変更では再インデックスが必要です。

```text
- chunkerVersion 変更
- embeddingModelId 変更
- extractorVersion 変更
- preprocessorVersion 変更
- 文書本文変更
- 拡張子別の抽出設定変更
- OCR 設定変更
- CAD / BIM 変換器バージョン変更
- 文書 metadata のうち検索品質に影響する項目変更
```

次の変更では embedding 再計算は不要です。

```text
- フォルダ共有設定変更
- ユーザーのグループ所属変更
- ロール変更
- お気に入り登録 / 解除
- 表示名だけの変更で、検索対象 metadata に影響しないもの
```

共有解除や権限変更は、検索時の authorization filter / manifest 再確認で即時反映します。

------

## 3A.13 チャンク品質チェック

取り込み完了前に、最低限次を検査します。

```text
- chunk 数が 0 ではない
- 異常に長い chunk がない
- tokenCount が maxTokens を超えていない
- page / offset / slide / sheet / cellRange / bbox の参照が壊れていない
- ParsedBlock、ExtractedTable、ExtractedFigure から citation 可能な参照を作れる
- OCR confidence、table extraction confidence、figure analysis confidence を保存する
- 図面系では drawingNumber / revision / layout / layer などの metadata 信頼度を記録する
- 表 chunk は列名、行名、単位、caption、注釈を失っていない
- 画像 / 図 chunk は figureId、caption または generatedDescription を持つ
- active 化前に indexVersion が紐づいている
- citation に必要な documentId / folderId / chunkId がある
- 取り込み対象外の拡張子が index に入っていない
- 解析品質ゲートに失敗した文書を active 化しない
```

------

## 3A.14 受け入れ条件

```text
AC-CHUNK-001:
取り込み完了前の文書は RAG 検索対象にならない。

AC-CHUNK-002:
active 文書には 1 つ以上の DocumentChunk が存在する。

AC-CHUNK-003:
DocumentChunk は documentId、folderId、indexVersion を持つ。

AC-CHUNK-004:
検索ヒット後、folder permission を再確認する。

AC-CHUNK-005:
チャンク化設定変更時は再インデックス対象になる。

AC-CHUNK-006:
共有設定変更だけでは embedding を再計算しない。

AC-CHUNK-007:
citation は chunkId、documentId、folderId、必要に応じて page / slide / sheet / drawing metadata を返す。

AC-CHUNK-008:
権限外チャンクは検索結果、rerank、citation、debug trace に出さない。

AC-CHUNK-009:
表を含む文書では、表の意味が壊れない単位で chunk 化する。

AC-CHUNK-010:
chunkerVersion、embeddingModelId、indexVersion は run 単位で追跡できる。

AC-CHUNK-011:
対象拡張子以外のファイルは RAG 検索対象にしない。

AC-CHUNK-012:
拡張子ごとの前処理結果、抽出結果、chunk 数、警告は IngestRun で確認できる。

AC-CHUNK-013:
図面系ファイルでは、抽出できた図面番号、改訂、尺度、単位、layer、bbox、title block を metadata として保持する。

AC-CHUNK-014:
CAD / BIM 変換器が未設定の場合、対象拡張子は failed または RAG非対象として明示される。
```

------



# 3B. ナレッジ品質・RAG利用可否

## 3B.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Knowledge quality | ナレッジ品質 | 文書が知識として信頼できるかを判断する品質概念。検証状態、鮮度、置き換え、抽出品質を含む。 |
| ragEligibility | RAG利用可否 | 文書をRAG回答の根拠として使えるかを示す状態。activeとは別管理。 |
| VerificationStatus | 検証ステータス | 文書内容が担当者に確認済みかを示す状態。 |
| FreshnessStatus | 鮮度ステータス | 文書が最新か、古いか、期限切れかを示す状態。 |
| SupersessionStatus | 置き換えステータス | 新版に置き換えられているかを示す状態。 |
| ExtractionQualityStatus | 抽出品質ステータス | OCR、表、図、レイアウト解析が回答根拠として使える品質かを示す状態。 |
| QualityFlag | 品質フラグ | 低OCR信頼、表抽出注意、未検証、旧版など個別の注意情報。 |
| Quality gate | 品質ゲート | 取り込みや回答前に品質基準を満たすか判定する関門。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| KnowledgeQualityStatus | ナレッジ品質ステータス | usable、usable_with_warning、needs_review、excluded_from_ragを表す。 |
| VerificationStatus | 検証ステータス | unverified、verified、verification_expired、rejectedを表す。 |
| FreshnessStatus | 鮮度ステータス | current、stale、expired、unknownを表す。 |
| SupersessionStatus | 置き換えステータス | latest、superseded、historicalを表す。 |
| ExtractionQualityStatus | 抽出品質ステータス | passed、partial、failed、needs_human_reviewを表す。 |
| DocumentQualityProfile | 文書品質プロファイル | 品質・検証・鮮度・置き換え・RAG利用可否をまとめて管理する。 |
| QualityFlag | 品質フラグ | 品質上の注意点を複数保持する。 |
| RagEligibilityPolicy | RAG利用可否ポリシー | どの品質状態を回答根拠として許可するかを定義する。 |

### 守るべきルール
- active文書でもragEligibilityがexcludedならRAG回答に使わない。
- 高リスクカテゴリではverified/current/latestを原則必須にする。
- expired、superseded、rejected文書を現在の根拠として使わない。
- 品質で除外された権限外文書の存在を利用者に示唆しない。
- 品質状態変更はembedding再計算なしで検索時に反映する。

### 実行すべき処理
1. 文書ごとに品質プロファイルを作成し、検証者、オーナー、レビュー期限を設定する。
2. 鮮度、検証期限、置き換え状態、抽出品質からragEligibilityを計算する。
3. 回答不能・低評価・問い合わせから品質改善タスクを作る。
4. 品質ステータス変更を監査ログに記録する。

### UI
- 文書一覧に検証済み、未検証、期限切れ、旧版、OCR低信頼、RAG除外などの品質バッジを表示する。
- 品質ダッシュボードで未検証、期限切れ、解析要確認、オーナー未設定を確認できる。
- 文書詳細から検証依頼、再解析、RAG除外、旧版化を実行できる。

------

## 3B.1 目的

ナレッジ品質は、文書が取り込み済みかどうかではなく、**現在の回答根拠として使ってよいか**を管理する機能です。

既存の文書ライフサイクルでは、文書は次の流れで処理されます。

```text
取り込み
  ↓
抽出 / 正規化
  ↓
チャンク化
  ↓
metadata 付与
  ↓
embedding
  ↓
検索インデックス登録
  ↓
active 化
```

ここに、品質ステータス、検証ステータス、鮮度ステータス、置き換え状態、解析品質ゲートを追加します。

重要な分離は次です。

```text
active:
取り込み・インデックス登録が完了している。

ragEligible:
現在の品質ポリシー上、RAG回答の根拠として使ってよい。
```

RAG検索対象の最終定義は次です。

```text
RAG検索対象 =
指定された回答範囲
∩ ユーザーが readOnly 以上を持つフォルダ
∩ active な文書
∩ RAG利用許可された品質状態の文書
∩ RAG利用許可された検証状態の文書
∩ RAG利用許可された鮮度状態の文書
∩ 解析品質が基準を満たす文書
```

つまり、active 文書であっても、次のような文書は通常RAG回答に使わない、または警告付き・限定利用にします。

```text
- 期限切れ
- 古い
- 未検証
- 検証期限切れ
- 解析失敗
- OCR信頼度が低い
- 表抽出が壊れている
- 図の説明が不足している
- 新版に置き換え済み
- 矛盾文書として要確認
```

## 3B.2 品質ステータス

### 型定義: `KnowledgeQualityStatus`（ナレッジ品質ステータス）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `KnowledgeQualityStatus` | ナレッジ品質ステータス | 文書が知識として利用できる状態か、要確認か、RAG除外かを示す。 |

| 英名（値） | 日本語名 | 内容 |
|---|---|---|
| `usable` | 利用可能 | 文書を通常の知識として使える状態。 |
| `usable_with_warning` | 警告付き利用可能 | 注意表示を出せば利用できる状態。 |
| `needs_review` | 要レビュー | 担当者の確認が必要な状態。 |
| `excluded_from_rag` | RAG除外 | RAG回答の根拠に使わない状態。 |


### 型定義: `VerificationStatus`（検証ステータス）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `VerificationStatus` | 検証ステータス | 文書内容が担当者に確認済みか、未検証か、検証期限切れかを示す。 |

| 英名（値） | 日本語名 | 内容 |
|---|---|---|
| `unverified` | 未検証 | 内容確認がまだ完了していない。 |
| `verified` | 検証済み | 担当者が内容を確認済み。 |
| `verification_expired` | 検証期限切れ | 以前は検証済みだが有効期限を過ぎている。 |
| `rejected` | 却下 | 根拠として使わない判断になった。 |


### 型定義: `FreshnessStatus`（鮮度ステータス）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `FreshnessStatus` | 鮮度ステータス | 文書が最新か、古いか、期限切れか、不明かを示す。 |

| 英名（値） | 日本語名 | 内容 |
|---|---|---|
| `current` | 最新 | 現在の情報として扱える。 |
| `stale` | 古い | 古い可能性があるため注意が必要。 |
| `expired` | 期限切れ | 現在の根拠としては原則利用しない。 |
| `unknown` | 不明 | 状態を判断できない。 |


### 型定義: `SupersessionStatus`（置き換えステータス）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `SupersessionStatus` | 置き換えステータス | 文書が最新版か、旧版に置き換え済みか、履歴用途かを示す。 |

| 英名（値） | 日本語名 | 内容 |
|---|---|---|
| `latest` | 最新版 | 置き換え関係上の最新文書。 |
| `superseded` | 置き換え済み | 新版に置き換えられた旧版。 |
| `historical` | 履歴用途 | 過去情報として扱う文書。 |


### 型定義: `ExtractionQualityStatus`（抽出品質ステータス）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ExtractionQualityStatus` | 抽出品質ステータス | OCR、表、図、レイアウト抽出が回答根拠として使える品質かを示す。 |

| 英名（値） | 日本語名 | 内容 |
|---|---|---|
| `passed` | 合格 | 基準を満たしている状態。 |
| `partial` | 一部合格 | 一部問題はあるが限定利用できる状態。 |
| `failed` | 失敗 | 処理が失敗した状態。 |
| `needs_human_review` | 人間レビュー要 | 担当者確認が必要な状態。 |


### 型定義: `DocumentQualityProfile`（文書品質プロファイル）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `DocumentQualityProfile` | 文書品質プロファイル | 文書ごとの検証、鮮度、置き換え、抽出品質、RAG利用可否をまとめた管理情報。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `documentId` | 文書ID | 必須 | `string` | 文書IDを一意に識別するためのIDです。 |
| `knowledgeQualityStatus` | ナレッジ品質状態 | 必須 | `KnowledgeQualityStatus` | 対象の現在のナレッジ品質状態を示します。 |
| `verificationStatus` | 検証状態 | 必須 | `VerificationStatus` | 対象の現在の検証状態を示します。 |
| `freshnessStatus` | 鮮度状態 | 必須 | `FreshnessStatus` | 対象の現在の鮮度状態を示します。 |
| `supersessionStatus` | 置き換え状態 | 必須 | `SupersessionStatus` | 対象の現在の置き換え状態を示します。 |
| `extractionQualityStatus` | 抽出品質状態 | 必須 | `ExtractionQualityStatus` | 対象の現在の抽出品質状態を示します。 |
| `ragEligibility` | RAG利用可否 | 必須 | `"eligible" / "eligible_with_warning" / "restricted" / "excluded"` | このデータで管理する「RAG利用可否」です。 |
| `verifiedBy` | 検証者 | 任意 | `string` | 検証者を示します。 |
| `verifiedAt` | 検証日時 | 任意 | `string` | 検証日時を記録します。 |
| `verificationExpiresAt` | 検証期限 | 任意 | `string` | 検証期限を記録します。 |
| `contentOwnerUserId` | 文書オーナーユーザーID | 任意 | `string` | 文書オーナーユーザーIDを一意に識別するためのIDです。 |
| `contentOwnerGroupId` | 文書オーナーグループID | 任意 | `string` | 文書オーナーグループIDを一意に識別するためのIDです。 |
| `effectiveFrom` | 有効開始日 | 任意 | `string` | このデータで管理する「有効開始日」です。 |
| `effectiveTo` | 有効終了日 | 任意 | `string` | このデータで管理する「有効終了日」です。 |
| `lastReviewedAt` | 最終レビュー日時 | 任意 | `string` | 最終レビュー日時を記録します。 |
| `nextReviewDueAt` | 次回レビュー期限 | 任意 | `string` | 次回レビュー期限を記録します。 |
| `supersededByDocumentId` | 置き換え先文書ID | 任意 | `string` | 置き換え先文書IDを一意に識別するためのIDです。 |
| `supersedesDocumentId` | 置き換え元文書ID | 任意 | `string` | 置き換え元文書IDを一意に識別するためのIDです。 |
| `qualityScore` | 品質スコア | 任意 | `number` | 品質スコアを数値で管理します。 |
| `extractionConfidence` | 抽出信頼度 | 任意 | `number` | 抽出信頼度を数値で管理します。 |
| `ocrConfidence` | OCR信頼度 | 任意 | `number` | OCR信頼度を数値で管理します。 |
| `tableExtractionConfidence` | 表抽出信頼度 | 任意 | `number` | 表抽出信頼度を数値で管理します。 |
| `figureAnalysisConfidence` | 図解析信頼度 | 任意 | `number` | 図解析信頼度を数値で管理します。 |
| `qualityFlags` | 品質フラグ | 必須 | `QualityFlag[]` | 注意が必要な品質フラグを記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


### 型定義: `QualityFlag`（品質フラグ）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `QualityFlag` | 品質フラグ | 未検証、OCR低信頼、表抽出注意など、文書品質上の注意理由。 |

| 英名（値） | 日本語名 | 内容 |
|---|---|---|
| `outdated` | 古い | 古い可能性がある。 |
| `unverified` | 未検証 | 内容確認がまだ完了していない。 |
| `verification_expired` | 検証期限切れ | 以前は検証済みだが有効期限を過ぎている。 |
| `superseded` | 置き換え済み | 新版に置き換えられた旧版。 |
| `conflicting_content` | 内容矛盾 | 他文書と矛盾している可能性がある。 |
| `low_ocr_confidence` | OCR低信頼 | OCR結果の信頼度が低い。 |
| `table_extraction_issue` | 表抽出問題 | 表抽出に問題がある。 |
| `figure_analysis_issue` | 図解析問題 | 図の解析に問題がある。 |
| `image_only_content` | 画像のみ | テキスト抽出できない画像中心の内容。 |
| `layout_reading_order_uncertain` | 読み順不確実 | レイアウト解析上の読み順が不確実。 |
| `missing_owner` | オーナー未設定 | 文書責任者が設定されていない。 |
| `missing_effective_date` | 有効日未設定 | 有効開始日または終了日が不足している。 |
| `missing_review_date` | レビュー期限未設定 | レビュー期限が設定されていない。 |
| `high_risk_category` | 高リスクカテゴリ | 法務・人事・安全など誤回答リスクが高いカテゴリ。 |
| `manual_review_required` | 手動レビュー必須 | 人間による確認が必要。 |


## 3B.3 鮮度・検証・置き換えの扱い

古い文書は一律削除しません。過去契約、旧版規程、監査資料、履歴確認では古い資料が必要になるためです。ただし、現在の制度や仕様を回答する通常チャットでは、品質ポリシーにより利用を制御します。

| 状態 | 通常RAGでの扱い | 補足 |
|---|---|---|
| `current` | 通常利用可能 | 最新根拠として扱える |
| `stale` | 原則は警告付きまたは除外 | 低リスクフォルダでは警告付き利用を許可可能 |
| `expired` | 通常回答では除外 | 履歴検索、監査、過去情報モードでのみ利用 |
| `unknown` | リスクカテゴリにより制御 | 高リスクでは除外、低リスクでは警告付き利用可能 |
| `verified` | 通常利用可能 | 検証期限内であること |
| `unverified` | デフォルト除外 | 低リスクでは警告付き利用可能 |
| `verification_expired` | 高リスクでは除外 | 低リスクでは警告付き利用可能 |
| `rejected` | 除外 | RAG、rerank、citation、debug trace に出さない |
| `latest` | 通常利用可能 | 最新版として扱える |
| `superseded` | 通常回答では除外 | 過去情報モードでのみ利用 |
| `historical` | 明示的に過去資料として扱う | 現在の制度・仕様の根拠にしない |

高リスクカテゴリでは、検証・オーナー・レビュー期限を必須にします。

```text
高リスクカテゴリ例:
- 法務
- 契約
- 人事制度
- 就業規則
- セキュリティ規程
- 価格表
- 製品仕様
- 医療・安全・コンプライアンス関連
```

高リスクフォルダで必須にする項目です。

```text
- contentOwnerUserId または contentOwnerGroupId
- effectiveFrom
- nextReviewDueAt
- verificationStatus = verified
```

回答生成時の扱いは次です。

```text
最新文書がある:
最新文書を優先する。

古い文書しかない:
高リスク質問では answer_unavailable。
低リスク質問では、ポリシーにより警告付き回答を許可。

新旧文書が矛盾する:
矛盾として明示し、必要に応じて answer_unavailable。

新版に置き換え済み:
通常回答では使わず、必要に応じて「最新版の根拠が見つからない」と返す。
```

未検証文書を警告付きで使う場合でも、利用者がその文書へのアクセス権を持たないときは、未検証文書の存在を示唆しません。

## 3B.4 RAG利用可否ポリシー

### 型定義: `RagEligibilityPolicy`（RAG利用可否ポリシー）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `RagEligibilityPolicy` | RAG利用可否ポリシー | どの品質状態の文書をRAG回答に使えるかを、組織・フォルダ・文書単位で決める設定。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `policyId` | ポリシーID | 必須 | `string` | ポリシーIDを一意に識別するためのIDです。 |
| `scopeType` | スコープ種別 | 必須 | `"tenant" / "folder" / "document" / "benchmark"` | 処理や設定を適用するスコープ種別を示します。 |
| `scopeId` | 範囲ID | 任意 | `string` | 範囲IDを一意に識別するためのIDです。 |
| `highRiskCategory` | 高リスクカテゴリ | 必須 | `boolean` | 高リスクカテゴリを有効にするか、条件を満たすかを示します。 |
| `allowUnverified` | 未検証利用許可 | 必須 | `boolean` | 未検証利用許可を有効にするか、条件を満たすかを示します。 |
| `allowVerificationExpired` | 検証期限切れ利用許可 | 必須 | `boolean` | 検証期限切れ利用許可を有効にするか、条件を満たすかを示します。 |
| `allowStale` | 古い文書利用許可 | 必須 | `boolean` | 古い文書利用許可を有効にするか、条件を満たすかを示します。 |
| `allowExpired` | 期限切れ利用許可 | 必須 | `boolean` | 期限切れ利用許可を有効にするか、条件を満たすかを示します。 |
| `allowSuperseded` | 置き換え済み利用許可 | 必須 | `boolean` | 置き換え済み利用許可を有効にするか、条件を満たすかを示します。 |
| `allowPartialExtraction` | 部分抽出利用許可 | 必須 | `boolean` | 部分抽出利用許可を有効にするか、条件を満たすかを示します。 |
| `allowLowOcrConfidence` | 低OCR信頼度利用許可 | 必須 | `boolean` | 低OCR信頼度利用許可を有効にするか、条件を満たすかを示します。 |
| `allowLowTableExtractionConfidence` | 低表抽出信頼度利用許可 | 必須 | `boolean` | 低表抽出信頼度利用許可を有効にするか、条件を満たすかを示します。 |
| `minOcrConfidence` | 最小OCR信頼度 | 必須 | `number` | 最小OCR信頼度を数値で管理します。 |
| `minTableExtractionConfidence` | 最小表抽出信頼度 | 必須 | `number` | 最小表抽出信頼度を数値で管理します。 |
| `minFigureAnalysisConfidence` | 最小図解析信頼度 | 任意 | `number` | 最小図解析信頼度を数値で管理します。 |
| `warningRequiredWhen` | 警告表示条件 | 必須 | `"never" / "unverified_or_stale" / "any_non_ideal_quality"` | 注意が必要な警告表示条件を記録します。 |
| `updatedBy` | 更新者 | 必須 | `string` | 更新者を示します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


RAG検索・回答生成では、次の順に品質を判定します。

```text
1. active か
2. ragEligibility が eligible / eligible_with_warning か
3. verificationStatus が許可状態か
4. freshnessStatus が許可状態か
5. supersessionStatus が通常回答で使える状態か
6. extractionQualityStatus が許可状態か
7. OCR / 表 / 図 / レイアウト解析の confidence が閾値以上か
8. citation 可能か
```

## 3B.5 管理画面の品質表示

文書一覧には、以下の品質バッジを表示します。

```text
- 検証済み
- 未検証
- 検証期限切れ
- 最新
- 古い
- 期限切れ
- 置き換え済み
- OCRあり
- OCR低信頼
- 表抽出注意
- 図解析注意
- 解析要確認
- RAG除外
```

文書詳細では、以下を表示します。

```text
- RAG利用可否
- 検証状態
- 鮮度状態
- 置き換え状態
- 文書オーナー
- レビュー期限
- 検証者
- 検証日時
- 期限切れ理由
- 抽出品質
- OCR信頼度
- 表抽出信頼度
- 図解析信頼度
- 解析ログ
- 再解析ボタン
- 検証依頼ボタン
- RAG対象から除外ボタン
```

管理ダッシュボードには、以下の品質カードを追加します。

```text
- 未検証文書
- 検証期限切れ文書
- 期限切れ文書
- 置き換え済みなのにRAG対象の文書
- OCR信頼度が低い文書
- 表抽出に失敗した文書
- 図解析に失敗した文書
- 解析要確認文書
- 文書オーナー未設定
- レビュー期限超過
- 矛盾候補
```

## 3B.6 品質起因の改善ループ

回答不能、低評価、担当者確認、ベンチマーク失敗から、次の改善アクションを作れるようにします。

```text
- 文書を検証依頼する
- 文書オーナーに確認依頼する
- 文書をRAG対象から除外する
- 旧版としてマークする
- 新版文書を追加する
- OCR再実行を依頼する
- 表抽出レビューを依頼する
- 図解析レビューを依頼する
- チャンク化設定を見直す
- benchmark case に登録する
```

## 3B.7 受け入れ条件：ナレッジ品質

```text
AC-KQ-001:
Document には lifecycleStatus とは別に、verificationStatus、freshnessStatus、supersessionStatus、extractionQualityStatus、ragEligibility を持てる。

AC-KQ-002:
active 文書であっても ragEligibility = excluded の文書は RAG 検索対象にならない。

AC-KQ-003:
expired 文書は、通常チャットのRAG回答根拠として使われない。

AC-KQ-004:
superseded 文書は、通常チャットのRAG回答根拠として使われない。

AC-KQ-005:
高リスクカテゴリの文書は、verificationStatus = verified でなければ通常RAG回答に使われない。

AC-KQ-006:
verification_expired の文書は、高リスクカテゴリではRAG回答から除外される。

AC-KQ-007:
stale 文書しか根拠がない場合、設定に応じて警告付き回答または answer_unavailable を返す。

AC-KQ-008:
unverified 文書しか根拠がない場合、設定に応じて警告付き回答または answer_unavailable を返す。

AC-KQ-009:
rejected 文書は RAG回答、rerank、citation、debug trace に出ない。

AC-KQ-010:
文書オーナー未設定の高リスク文書は、管理ダッシュボードの要対応に表示される。

AC-KQ-011:
nextReviewDueAt を過ぎた文書は、freshnessStatus = stale または verification_expired に更新される。

AC-KQ-012:
verificationStatus、freshnessStatus、ragEligibility の変更は、embedding 再計算なしで検索時に即時反映される。

AC-KQ-013:
品質ステータス変更は監査ログに記録される。

AC-KQ-014:
品質ステータス変更時には、変更前、変更後、変更者、理由、対象文書を保存する。

AC-KQ-015:
権限のない文書が品質ポリシーで除外された場合でも、ユーザーにその文書の存在を示唆しない。

AC-KQ-016:
回答に stale または unverified 文書を使う場合、回答本文または citation 付近に注意表示を出す。

AC-KQ-017:
矛盾する複数文書が根拠候補にある場合、RAGは片方を勝手に正とせず、矛盾として扱う。

AC-KQ-018:
同種の品質起因の answer_unavailable は benchmark case として登録できる。

AC-KQ-019:
問い合わせ対応画面から文書検証依頼、文書オーナー確認、RAG除外、再解析依頼を作成できる。

AC-KQ-020:
管理ダッシュボードで未検証、期限切れ、検証期限切れ、解析要確認、OCR低信頼の文書数を確認できる。
```

------

# 3C. 高度文書解析・構造化抽出

## 3C.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Structured extraction | 構造化抽出 | 見出し、段落、表、図、脚注、座標、読み順などを構造として保持する抽出。 |
| OCR | 文字認識 | 画像やスキャンPDFから文字を読み取る処理。 |
| OCR confidence | OCR信頼度 | OCR結果が正しい可能性を示す値。 |
| Layout analysis | レイアウト解析 | ページ内の見出し、段落、表、図、読み順、bboxを解析する処理。 |
| Table extraction | 表抽出 | 表を列名、行名、セル、結合セル、単位として取り出す処理。 |
| Figure extraction | 図抽出 | 図、グラフ、スクリーンショットなどをcaptionや説明付きで取り出す処理。 |
| bbox | 境界ボックス | ページや図面上の位置をx、y、幅、高さで示す座標情報。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| ParsedDocument | 構造化解析済み文書 | ページ、ブロック、抽出サマリー、解析エンジンバージョンを管理する。 |
| ParsedPage | 解析済みページ | ページ種別、サイズ、OCR信頼度、回転補正などを管理する。 |
| ParsedBlock | 解析済みブロック | 見出し、段落、表、図、脚注、bbox、読み順を管理する。 |
| ExtractionSummary | 抽出サマリー | 文字数、ブロック数、警告、品質概要を管理する。 |
| ExtractedTable | 抽出表 | caption、列、行、セル、結合セル、bbox、信頼度を管理する。 |
| ExtractedFigure | 抽出図 | 図種別、caption、周辺テキスト、生成説明、OCRテキストを管理する。 |

### 守るべきルール
- PDFはテキストPDF、スキャンPDF、混在PDF、複雑レイアウトPDF、フォームPDFで処理を分ける。
- 表は通常段落と混ぜすぎず、列名・単位・注釈をchunkに含める。
- 装飾画像はRAG対象から除外し、意味を持つ図はcaptionまたは説明を根拠にする。
- OCR信頼度が低い数値・金額・日付は断定回答に使わない。
- 解析不能、0文字、0chunk、citation不能の文書はactive化しない。

### 実行すべき処理
1. PDF種別をページ単位または文書単位で分類する。
2. 必要なページにOCRを実行し、信頼度を保存する。
3. レイアウト解析で読み順、bbox、表、図、脚注を抽出する。
4. 表と図を専用データとして保存し、チャンク化時に参照する。
5. 抽出品質ゲートを通過できない箇所をレビュー対象にする。

### UI
- 文書詳細にページプレビュー、抽出ブロック、表プレビュー、図プレビュー、OCR信頼度を表示する。
- 解析エラー画面でページ番号、失敗理由、再OCR、再解析、人間レビューへの導線を表示する。

------

## 3C.1 目的

高度文書解析では、文書を単なるテキスト列ではなく、ページ、ブロック、表、図、画像、OCR、原文位置を持つ構造化データとして扱います。

抽出対象は次です。

```text
- ページ
- 見出し
- 段落
- 箇条書き
- 表
- 図
- 画像
- 注釈
- 脚注
- ヘッダー / フッター
- フォームフィールド
- OCRテキスト
- 読み取り信頼度
- 原文位置
- bounding box
```

## 3C.2 構造化抽出データ

### 型定義: `ParsedDocument`（構造化解析済み文書）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ParsedDocument` | 構造化解析済み文書 | ページ、ブロック、表、図など、文書構造を解析した結果。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `parsedDocumentId` | 構造化解析済み文書ID | 必須 | `string` | 構造化解析済み文書IDを一意に識別するためのIDです。 |
| `documentId` | 文書ID | 必須 | `string` | 文書IDを一意に識別するためのIDです。 |
| `ingestRunId` | 取り込み実行ID | 必須 | `string` | 取り込み実行IDを一意に識別するためのIDです。 |
| `parserVersion` | 解析器バージョン | 必須 | `string` | 利用した解析器バージョンを記録し、再実行や差分確認に使います。 |
| `ocrEngineVersion` | OCRエンジンバージョン | 任意 | `string` | 利用したOCRエンジンバージョンを記録し、再実行や差分確認に使います。 |
| `layoutModelVersion` | レイアウト解析モデルバージョン | 任意 | `string` | 利用したレイアウト解析モデルバージョンを記録し、再実行や差分確認に使います。 |
| `tableExtractorVersion` | 表抽出器バージョン | 任意 | `string` | 利用した表抽出器バージョンを記録し、再実行や差分確認に使います。 |
| `figureAnalyzerVersion` | 図解析器バージョン | 任意 | `string` | 利用した図解析器バージョンを記録し、再実行や差分確認に使います。 |
| `pages` | ページ一覧 | 必須 | `ParsedPage[]` | このデータで管理する「ページ一覧」です。 |
| `blocks` | blocks | 必須 | `ParsedBlock[]` | このデータで管理する「blocks」です。 |
| `tables` | 表一覧 | 必須 | `ExtractedTable[]` | このデータで管理する「表一覧」です。 |
| `figures` | 図一覧 | 必須 | `ExtractedFigure[]` | このデータで管理する「図一覧」です。 |
| `extractionSummary` | 抽出要約 | 必須 | `ExtractionSummary` | このデータで管理する「抽出要約」です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |


### 型定義: `ParsedPage`（解析済みページ）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ParsedPage` | 解析済みページ | ページ単位の種類、サイズ、OCR信頼度、回転補正などの情報。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `pageNumber` | ページ数値 | 必須 | `number` | ページ数値を数値で管理します。 |
| `width` | 幅 | 任意 | `number` | 幅を数値で管理します。 |
| `height` | 高さ | 任意 | `number` | 高さを数値で管理します。 |
| `pageType` | ページ種別 | 必須 | `"digital_text" / "scanned_image" / "mixed" / "image_only" / "unknown"` | このデータで管理する「ページ種別」です。 |
| `textCoverageRatio` | テキストcoverageratio | 任意 | `number` | テキストcoverageratioを数値で管理します。 |
| `ocrConfidence` | OCR信頼度 | 任意 | `number` | OCR信頼度を数値で管理します。 |
| `rotationDetected` | rotationdetected | 任意 | `boolean` | rotationdetectedを有効にするか、条件を満たすかを示します。 |
| `rotationCorrected` | rotationcorrected | 任意 | `boolean` | rotationcorrectedを有効にするか、条件を満たすかを示します。 |


### 型定義: `ParsedBlock`（解析済みブロック）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ParsedBlock` | 解析済みブロック | 見出し、段落、表、図、脚注など、ページ内の構造単位。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `blockId` | ブロックID | 必須 | `string` | ブロックIDを一意に識別するためのIDです。 |
| `pageNumber` | ページ数値 | 必須 | `number` | ページ数値を数値で管理します。 |
| `blockType` | ブロック種別 | 必須 | `"heading" / "paragraph" / "list" / "table" / "figure" / "image" / "caption" / "footnote" / "header" / "footer" / "form_field" / "unknown"` | このデータで管理する「ブロック種別」です。 |
| `text` | テキスト | 任意 | `string` | テキストとして表示または処理する文字列です。 |
| `markdown` | Markdown表現 | 任意 | `string` | このデータで管理する「Markdown表現」です。 |
| `bbox` | 位置座標 | 任意 | `object（主な項目: x, y, width, height）` | このデータで管理する「位置座標」です。 |
| `confidence` | 信頼度 | 任意 | `number` | 信頼度を数値で管理します。 |
| `readingOrderIndex` | 読み順番号 | 必須 | `number` | 読み順番号を数値で管理します。 |
| `parentBlockId` | 親ブロックID | 任意 | `string` | 親ブロックIDを一意に識別するためのIDです。 |
| `relatedBlockIds` | 関連ブロックID一覧 | 任意 | `string[]` | 複数の関連ブロックを識別するIDの一覧です。 |


### 型定義: `ExtractionSummary`（抽出サマリー）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ExtractionSummary` | 抽出サマリー | 抽出された文字数、ページ数、表数、図数、失敗ページなどの要約。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `pageCount` | ページ数 | 必須 | `number` | ページ数を数値で管理します。 |
| `blockCount` | ブロック数 | 必須 | `number` | ブロック数を数値で管理します。 |
| `tableCount` | 表数 | 必須 | `number` | 表数を数値で管理します。 |
| `figureCount` | 図数 | 必須 | `number` | 図数を数値で管理します。 |
| `chunkCount` | チャンク数 | 必須 | `number` | チャンク数を数値で管理します。 |
| `extractedTextLength` | 抽出文字数 | 必須 | `number` | 抽出文字数を数値で管理します。 |
| `ocrPageCount` | OCRページ数 | 必須 | `number` | OCRページ数を数値で管理します。 |
| `minOcrConfidence` | 最小OCR信頼度 | 任意 | `number` | 最小OCR信頼度を数値で管理します。 |
| `averageOcrConfidence` | 平均OCR信頼度 | 任意 | `number` | 平均OCR信頼度を数値で管理します。 |
| `minTableExtractionConfidence` | 最小表抽出信頼度 | 任意 | `number` | 最小表抽出信頼度を数値で管理します。 |
| `averageTableExtractionConfidence` | 平均表抽出信頼度 | 任意 | `number` | 平均表抽出信頼度を数値で管理します。 |
| `minFigureAnalysisConfidence` | 最小図解析信頼度 | 任意 | `number` | 最小図解析信頼度を数値で管理します。 |
| `failedPageNumbers` | 失敗ページ番号一覧 | 必須 | `number[]` | 失敗ページ番号一覧を数値で管理します。 |
| `warningCodes` | 警告codes | 必須 | `string[]` | 注意が必要な警告codesを記録します。 |


## 3C.3 PDF種別ごとの処理

PDFは一種類ではないため、ページ単位で種別を判定します。

| PDF種別 | 判定 | 処理方針 |
|---|---|---|
| テキストPDF | 選択可能な文字がある | OCRを原則使わず、ネイティブテキストを優先する |
| スキャンPDF | ページ全体が画像 | OCRを実行し、ページ単位の ocrConfidence を保存する |
| 混在PDF | ページごとにテキストと画像が混在 | ページ単位でテキスト抽出 / OCR を切り替える |
| 複雑レイアウトPDF | 2段組、表、注釈、脚注、図表が多い | レイアウト解析を行い、読み順・表・図・脚注を保持する |
| フォームPDF | 入力欄、チェックボックス、署名欄を含む | フィールド名と値をペアで抽出する |

## 3C.4 表抽出

表は通常テキストとは別に扱います。表については、以下を保持します。

```text
- tableId
- ページ番号
- caption
- 列名
- 行名
- セル値
- 結合セル
- 単位
- 注釈
- markdown表現
- CSV/JSON表現
- bbox
- 抽出信頼度
```

### 型定義: `ExtractedTable`（抽出表）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ExtractedTable` | 抽出表 | 表のcaption、セル、結合セル、bbox、抽出信頼度を保持する。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `tableId` | 表ID | 必須 | `string` | 表IDを一意に識別するためのIDです。 |
| `documentId` | 文書ID | 必須 | `string` | 文書IDを一意に識別するためのIDです。 |
| `pageNumber` | ページ数値 | 必須 | `number` | ページ数値を数値で管理します。 |
| `caption` | caption | 任意 | `string` | このデータで管理する「caption」です。 |
| `markdown` | Markdown表現 | 必須 | `string` | このデータで管理する「Markdown表現」です。 |
| `cells` | セル一覧 | 必須 | `object[]（主な項目: rowIndex, columnIndex, rowSpan, colSpan, text, confidence）` | このデータで管理する「セル一覧」です。 |
| `bbox` | 位置座標 | 任意 | `object（主な項目: x, y, width, height）` | このデータで管理する「位置座標」です。 |
| `extractionConfidence` | 抽出信頼度 | 必須 | `number` | 抽出信頼度を数値で管理します。 |
| `flags` | フラグ一覧 | 必須 | `"merged_cells_detected" / "header_uncertain" / "multi_page_table" / "low_confidence" / "manual_review_required"` | 注意が必要なフラグ一覧を記録します。 |


表チャンクの方針は次です。

```text
- 小さい表は表全体を1 chunkにする
- 大きい表は行グループ単位で chunk 化する
- 列名は各 chunk に必ず含める
- 単位・注釈・captionを chunk に含める
- 表の一部だけを引用する場合でも、tableId とページ番号を citation に返す
- 表抽出信頼度が低い箇所だけを根拠に、数値・金額・日付を断定しない
```

## 3C.5 画像・図・スクリーンショット

画像は次の3種類に分けます。

```text
1. 文字を含む画像
   スクリーンショット、画像化された表、図中ラベルなど。

2. 意味を持つ図
   フロー図、構成図、グラフ、組織図など。

3. 装飾画像
   ロゴ、背景、アイコンなど。
```

処理方針は次です。

```text
文字を含む画像:
OCR対象にする。

意味を持つ図:
画像説明、caption、周辺テキスト、図番号を抽出する。

装飾画像:
RAG対象から除外する。
```

### 型定義: `ExtractedFigure`（抽出図）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ExtractedFigure` | 抽出図 | 図、グラフ、スクリーンショット、写真などの説明、OCR文字、RAG利用可否を保持する。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `figureId` | 図ID | 必須 | `string` | 図IDを一意に識別するためのIDです。 |
| `documentId` | 文書ID | 必須 | `string` | 文書IDを一意に識別するためのIDです。 |
| `pageNumber` | ページ数値 | 必須 | `number` | ページ数値を数値で管理します。 |
| `figureType` | 図種別 | 必須 | `"diagram" / "chart" / "screenshot" / "photo" / "logo" / "decorative" / "unknown"` | このデータで管理する「図種別」です。 |
| `caption` | caption | 任意 | `string` | このデータで管理する「caption」です。 |
| `surroundingText` | 周辺テキスト | 任意 | `string` | 周辺テキストとして表示または処理する文字列です。 |
| `generatedDescription` | 生成説明 | 任意 | `string` | このデータで管理する「生成説明」です。 |
| `ocrText` | OCRテキスト | 任意 | `string` | OCRテキストとして表示または処理する文字列です。 |
| `bbox` | 位置座標 | 任意 | `object（主な項目: x, y, width, height）` | このデータで管理する「位置座標」です。 |
| `confidence` | 信頼度 | 任意 | `number` | 信頼度を数値で管理します。 |
| `ragEligible` | RAG利用可能 | 必須 | `boolean` | RAG利用可能を有効にするか、条件を満たすかを示します。 |


図や画像を RAG に使う場合は、回答に「図の説明を根拠にしている」ことが分かる citation を返します。

```text
例:
出典: system_architecture.pdf p.12 図3「全体構成」
```

## 3C.6 OCR品質ゲート

スキャン文書では、OCR誤読による誤回答が起きやすいため、OCR結果に信頼度を持たせます。

| OCR信頼度 | 通常RAGでの扱い |
|---|---|
| `ocrConfidence >= 0.90` | 通常利用可能 |
| `0.75 <= ocrConfidence < 0.90` | 警告付き利用、またはフォルダポリシーに従う |
| `ocrConfidence < 0.75` | RAG回答から除外し、人間レビュー対象にする |

特に以下はレビュー対象にします。

```text
- 数値が多い
- 金額が多い
- 日付が多い
- 契約条項
- 法令・規程
- 医療・安全・セキュリティ関連
- OCR信頼度がページごとに大きくばらつく
```

## 3C.7 解析品質ゲート

解析品質ゲートは、active 化、RAG利用可否、再解析要否を判断します。

```text
合格:
- 1文字以上の抽出テキスト、または意味ある表 / 図 / metadata がある
- 1つ以上の chunk が作成される
- chunk から citation が作れる
- page / offset / bbox / tableId / figureId の参照が壊れていない
- OCR / 表 / 図の confidence がポリシー閾値を満たす

部分合格:
- 一部ページや一部表は失敗したが、根拠として使える範囲が明確
- 失敗箇所が ingest run と文書詳細で確認できる
- 通常RAGでは警告付き利用または限定利用

不合格:
- 0文字、0chunk、citation不能
- 高リスク文書で OCR / 表 / 図の confidence が閾値未満
- 重要ページの解析失敗
- 読み順が不確実で回答誤りが起きやすい
```

## 3C.8 受け入れ条件：高度文書解析

```text
AC-PARSE-001:
取り込み時に、文書種別を digital_text、scanned_image、mixed、image_only、unknown のいずれかに分類する。

AC-PARSE-002:
テキストPDFでは、原則としてネイティブテキスト抽出を優先し、不要なOCRを実行しない。

AC-PARSE-003:
スキャンPDFではOCRを実行し、ページ単位の ocrConfidence を保存する。

AC-PARSE-004:
mixed PDF では、ページ単位でテキスト抽出とOCRを切り替える。

AC-PARSE-005:
抽出結果には pageNumber、heading、paragraph、table、figure、caption、footnote のブロック種別を保存できる。

AC-PARSE-006:
各ブロックには readingOrderIndex を持たせ、2段組や複雑レイアウトでも読み順を再現できる。

AC-PARSE-007:
citation には文書名、ページ番号、必要に応じて見出し、表ID、図IDを返せる。

AC-PARSE-008:
抽出されたテキストには、可能な限り原文位置 offset または bounding box を保持する。

AC-PARSE-009:
表を含む文書では、表を markdown 形式で保存する。

AC-PARSE-010:
表の列名、行名、セル値、結合セル情報を保持できる。

AC-PARSE-011:
表チャンクには列名と単位を含め、セル値だけの孤立 chunk を作らない。

AC-PARSE-012:
複数ページにまたがる表は、multi_page_table としてフラグ付けされる。

AC-PARSE-013:
表抽出信頼度が閾値未満の場合、extractionQualityStatus = needs_human_review になる。

AC-PARSE-014:
画像・図・スクリーンショットは figure / image block として保存できる。

AC-PARSE-015:
文字を含む画像にはOCRを実行し、ocrText を保存できる。

AC-PARSE-016:
装飾画像、ロゴ、背景画像はRAG対象から除外できる。

AC-PARSE-017:
意味を持つ図には caption、surroundingText、generatedDescription のいずれかを保存できる。

AC-PARSE-018:
OCR信頼度が閾値未満のページは、RAG回答根拠として使われない、または警告付き利用になる。

AC-PARSE-019:
数値、金額、日付を含むOCR低信頼ページは、人間レビュー対象になる。

AC-PARSE-020:
抽出結果が0文字、0chunk、または citation 不能の場合、文書は active 化されない。

AC-PARSE-021:
chunk 数、tokenCount、page参照、offset参照、table参照、figure参照の品質チェックに合格しなければ、取り込みは completed にならない。

AC-PARSE-022:
解析に部分失敗した文書は extractionQualityStatus = partial となり、失敗箇所を文書詳細で確認できる。

AC-PARSE-023:
解析失敗したページがある場合、ページ番号と失敗理由を ingest run に保存する。

AC-PARSE-024:
parserVersion、ocrEngineVersion、layoutModelVersion、tableExtractorVersion を ingest run 単位で追跡できる。

AC-PARSE-025:
parserVersion、ocrEngineVersion、layoutModelVersion、tableExtractorVersion の変更時は再解析または再インデックス対象にできる。

AC-PARSE-026:
再解析前後の抽出差分を確認できる。

AC-PARSE-027:
再解析によりRAG利用可否が変わる場合、cutover前に確認できる。

AC-PARSE-028:
解析要確認の文書は管理ダッシュボードに表示される。

AC-PARSE-029:
解析要確認の文書から、人間レビュー、再OCR、再解析、RAG除外を実行できる。

AC-PARSE-030:
権限外文書の解析エラーや品質状態は、権限のないユーザーのUI、citation、debug traceに表示されない。
```

------

# 4. チャット

## 4.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| SearchScope | 回答範囲 / 検索範囲 | チャットで回答に使う資料範囲。全フォルダ、特定フォルダ、特定文書、一時添付を扱う。 |
| Citation | 引用 | 回答の根拠として表示する文書名、ページ、チャンク、抜粋。 |
| Conversation compression | 会話圧縮 | 長い会話履歴を回答に必要な情報だけへ要約・圧縮すること。要約自体は最終根拠にしない。 |
| Decontextualized query | 文脈独立化クエリ | 会話履歴を踏まえ、単独でも意味が通る検索用質問に変換したもの。 |
| Previous citation anchoring | 前回引用アンカー検索 | 前回回答の引用を次の検索の手がかりにすること。 |
| MemoryCard | メモリカード | 会話の要点を保持する検索補助情報。最終citationにはせず元チャンクへ展開する。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| ChatSession | チャットセッション | 会話単位、所有者、既定回答範囲、状態を管理する。 |
| ChatMessage | チャットメッセージ | ユーザー発話、AI回答、状態、citation、フィードバックを管理する。 |
| SearchScope | 検索範囲 | all、folders、documents、temporaryの回答範囲を表す。 |
| Citation | 引用 | 回答の根拠として表示する文書、チャンク、ページ、抜粋を表す。 |
| ConversationState | 会話状態 | active topics、entities、documents、previous citationsなどを管理する。 |
| ConversationRagState | 会話RAG状態 | マルチターン検索で使う検索補助情報を管理する。 |
| PreviousCitationAnchor | 前回引用アンカー | 前回引用を次の検索に使うための参照情報。 |
| ConversationMemoryCard | 会話メモリカード | 会話要約と元チャンク参照を持つ検索補助情報。 |

### 守るべきルール
- 回答範囲は送信前と回答中に常時表示する。
- mode=allは全社資料ではなく、ユーザーが閲覧可能な資料だけを対象にする。
- 会話履歴、assistant過去発話、memory summaryを最終根拠として引用しない。
- マルチターンでは省略質問を文脈独立化し、前回引用を必要に応じて検索アンカーにする。
- 権限外文書や品質不合格文書は検索・引用・UI表示に出さない。

### 実行すべき処理
1. 送信時に回答範囲、モデル、一時添付を確定する。
2. 会話状態を作り、省略表現を含む質問を検索可能な形へ変換する。
3. チャット内RAG・回答生成・ツール実行を呼び出し、結果をメッセージとして保存する。
4. 低評価や回答不能時は問い合わせ対応への導線を作る。

### UI
- composerに回答範囲、モデル、添付、送信ボタンを常時表示する。
- 回答にはcitation、品質警告、回答不能時の次アクションを表示する。
- マルチターンで参照している前回引用や対象文書を、利用者に分かる範囲で表示する。

------

## 4.1 チャットの目的

チャットは、利用者が閲覧可能な文書を根拠に質問する機能です。

重要なのは、質問前に **回答範囲** が分かることです。

```text
回答範囲:
- 閲覧可能なすべての資料
- 特定フォルダ
- 特定文書
- 一時添付
```

------

## 4.2 チャットセッション

### 型定義: `ChatSession`（チャットセッション）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ChatSession` | チャットセッション | ユーザーが行う一連の会話。既定の回答範囲を持つ。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `sessionId` | セッションID | 必須 | `string` | セッションIDを一意に識別するためのIDです。 |
| `tenantId` | テナントID | 必須 | `string` | テナントIDを一意に識別するためのIDです。 |
| `ownerUserId` | 所有者ユーザーID | 必須 | `string` | 所有者ユーザーIDを一意に識別するためのIDです。 |
| `title` | タイトル | 必須 | `string` | このデータで管理する「タイトル」です。 |
| `status` | 状態 | 必須 | `"active" / "archived" / "deleted"` | 対象の現在の状態を示します。 |
| `defaultSearchScope` | 既定検索範囲 | 必須 | `SearchScope` | 処理や設定を適用する既定検索範囲を示します。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


------

## 4.3 メッセージ

### 型定義: `ChatMessage`（チャットメッセージ）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ChatMessage` | チャットメッセージ | ユーザー、AI、システムが送受信した1件の発話。引用やフィードバックを保持する。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `messageId` | メッセージID | 必須 | `string` | メッセージIDを一意に識別するためのIDです。 |
| `sessionId` | セッションID | 必須 | `string` | セッションIDを一意に識別するためのIDです。 |
| `role` | 役割 | 必須 | `"user" / "assistant" / "system"` | このデータで管理する「役割」です。 |
| `content` | 本文 | 必須 | `string` | 本文として表示または処理する文字列です。 |
| `status` | 状態 | 必須 | `"queued" / "running" / "completed" / "failed"` | 対象の現在の状態を示します。 |
| `searchScope` | 検索範囲 | 任意 | `SearchScope` | 処理や設定を適用する検索範囲を示します。 |
| `citations` | 引用一覧 | 任意 | `Citation[]` | このデータで管理する「引用一覧」です。 |
| `feedback` | フィードバック | 任意 | `"positive" / "negative"` | このデータで管理する「フィードバック」です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |


------

## 4.4 検索範囲

### 型定義: `SearchScope`（検索範囲）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `SearchScope` | 検索範囲 | チャットやベンチマークで、どのフォルダ・文書・一時添付を回答対象にするかを表す。 |

| 英名（値） | 日本語名 | 内容 |
|---|---|---|
| `all` | 全範囲 | 閲覧可能なすべての資料を対象にする。 |
| `folders` | フォルダ指定 | 指定フォルダを対象にする。 |
| `documents` | 文書指定 | 指定文書を対象にする。 |
| `temporary` | 一時添付 | 会話内の一時添付を対象にする。 |


優先順位は次です。

```text
1. 対象文書
2. 対象フォルダ
3. 閲覧可能なすべての資料
4. 一時添付
```

一時添付は、永続フォルダとは分けて表示します。

```text
[回答範囲: Aさん /xxx]
[一時添付: invoice.pdf]
```

------

## 4.5 チャット画面要件

composer には回答範囲を常時表示します。

```text
┌─────────────────────────────────────┐
│ 質問を入力してください...              │
├─────────────────────────────────────┤
│ [回答範囲: 全フォルダ ▼] [モデル ▼] [📎] [送信] │
└─────────────────────────────────────┘
```

フォルダ指定時:

```text
[回答範囲: group_a /team ▼]
```

文書指定時:

```text
[対象文書: handbook.pdf ×解除]
```

一時添付あり:

```text
[回答範囲: group_a /team ▼] [一時添付: invoice.pdf ×]
```

------

## 4.6 チャットの認可

チャット送信にはアプリ権限が必要です。

```text
chat:create
```

さらに、検索対象には resource-level permission が必要です。

```text
対象フォルダ:
readOnly 以上

対象文書:
所属フォルダに readOnly 以上

一時添付:
同一 session / temporaryScopeId
```

RAG 検索対象は次です。

```text
検索対象 =
指定された回答範囲
∩ ユーザーが readOnly 以上を持つフォルダ
∩ active な文書
∩ RAG利用許可された品質状態の文書
∩ RAG利用許可された検証状態の文書
∩ RAG利用許可された鮮度状態の文書
∩ 解析品質が基準を満たす文書
```

`active` は検索インデックス登録済みであることを示すだけであり、回答根拠として使ってよいことを意味しません。チャットでは、権限確認後、quality policy により evidence 候補をさらに絞り込みます。

------

## 4.7 回答引用

回答には citation を表示します。

### 型定義: `Citation`（引用）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `Citation` | 引用 | 回答の根拠として表示する文書、ページ、チャンク、抜粋。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `documentId` | 文書ID | 必須 | `string` | 文書IDを一意に識別するためのIDです。 |
| `documentTitle` | 文書タイトル | 必須 | `string` | このデータで管理する「文書タイトル」です。 |
| `folderId` | フォルダID | 必須 | `string` | フォルダIDを一意に識別するためのIDです。 |
| `folderLabel` | フォルダ表示名 | 必須 | `string` | このデータで管理する「フォルダ表示名」です。 |
| `chunkId` | チャンクID | 必須 | `string` | チャンクIDを一意に識別するためのIDです。 |
| `page` | ページ | 任意 | `number` | ページを数値で管理します。 |
| `headingPath` | 見出しパス | 任意 | `string[]` | このデータで管理する「見出しパス」です。 |
| `tableId` | 表ID | 任意 | `string` | 表IDを一意に識別するためのIDです。 |
| `tableCaption` | 表caption | 任意 | `string` | このデータで管理する「表caption」です。 |
| `figureId` | 図ID | 任意 | `string` | 図IDを一意に識別するためのIDです。 |
| `figureCaption` | 図caption | 任意 | `string` | このデータで管理する「図caption」です。 |
| `bbox` | 位置座標 | 任意 | `object（主な項目: x, y, width, height）` | このデータで管理する「位置座標」です。 |
| `quote` | 引用抜粋 | 任意 | `string` | このデータで管理する「引用抜粋」です。 |
| `qualityWarnings` | 品質警告 | 任意 | `"stale" / "unverified" / "low_ocr_confidence" / "table_extraction_uncertain" / "figure_analysis_uncertain"` | 注意が必要な品質警告を記録します。 |


citation には、権限外文書を含めてはいけません。

------

## 4.8 一時添付

一時添付は通常の文書管理に混ぜません。

```text
- この会話だけで参照
- 通常フォルダには保存しない
- 通常文書一覧には出さない
- TTL 後に削除
```

一時添付を永続化する場合は、明示操作にします。

```text
一時添付をフォルダに保存
```

条件:

```text
- 保存先フォルダ full
- 文書アップロード権限
```

------

## 4.9 チャットの受け入れ条件

```text
AC-CHAT-001:
ユーザーは現在の回答範囲を常に確認できる。

AC-CHAT-002:
チャット送信には chat:create が必要。

AC-CHAT-003:
指定フォルダに readOnly 以上がない場合、そのフォルダは検索対象にならない。

AC-CHAT-004:
mode=all でも、閲覧可能で、active かつ quality policy を満たす文書だけを検索対象にする。

AC-CHAT-005:
対象文書指定はフォルダ指定より優先される。

AC-CHAT-006:
一時添付は同一チャットでのみ参照される。

AC-CHAT-007:
citation に権限外文書を含めない。

AC-CHAT-008:
権限外文書の存在を示唆する回答を返さない。

AC-CHAT-009:
指定フォルダが削除・権限変更された場合、UI は安全に全フォルダへ戻すか、エラーを表示する。

AC-CHAT-010:
回答に低評価を付けた場合、問い合わせ対応へ送れる。

AC-CHAT-Q-001:
品質ポリシーで除外された文書の存在や件数は、一般利用者のチャットUIに表示しない。

AC-CHAT-Q-002:
回答に stale / unverified / low confidence の根拠を使う場合、ポリシーに応じて回答本文または citation 付近に注意を表示する。
```

------

## 4.10 チャットで対象とするユースケース

チャット機能は、次のユースケースを明示的な対象にします。

| ユースケース | 代表例 | 対応方針 |
|---|---|---|
| マルチターンチャット | 過去の質問、前提、条件変更を踏まえた継続質問 | 会話状態、短期履歴、圧縮サマリ、未解決事項、前回 citation を管理する |
| 設計業界の図面QA | 図面番号、改訂、尺度、通り芯、注記、部材表、レイヤーに関する質問 | 図面 metadata、title block、layer / block / bbox、sheet render、OCR、表抽出を併用する |
| 社内相談QA | 規程、手順書、稟議、社内ナレッジに対する相談 | 権限内 RAG、検索語対応づけ、回答不能時の担当者対応、検索改善ループを使う |
| 500ページ超PDFへの質疑応答 | 契約書、仕様書、設計基準、マニュアル全体から該当箇所を探す | 階層チャンク、章節 metadata、親子 chunk、要約 index、ページ単位 citation を使う |

対象外または制限付き:

```text
- 権限外資料を推測して回答すること
- 根拠がない断定回答
- 図面ファイルの自動編集や CAD への書き戻し
- 法務、医療、人事などで最終判断を AI のみに委ねること
```

------

## 4.11 マルチターンチャットと会話圧縮

マルチターンチャットでは、すべての過去発話を毎回そのまま LLM に投入しません。
会話が長くなると、重要情報が中間で埋もれる、検索クエリが曖昧になる、コストが増えるためです。

基本方針:

```text
1. 直近ターンは raw message として保持する。
2. 古いターンは構造化サマリに圧縮する。
3. ユーザーの恒久的な希望と、その会話内だけの一時条件を分ける。
4. 未解決事項、決定事項、参照済み citation を明示的に保持する。
5. 回答時は、圧縮サマリ + 直近発話 + 必要な RAG evidence を組み合わせる。
6. 圧縮サマリ自体も更新履歴と version を持つ。
```

### 型定義: `ConversationState`（会話状態）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ConversationState` | 会話状態 | マルチターンチャットで、直近質問、要約、参照済み引用などを保持する状態。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `sessionId` | セッションID | 必須 | `string` | セッションIDを一意に識別するためのIDです。 |
| `recentMessageIds` | 直近メッセージID一覧 | 必須 | `string[]` | 複数の直近メッセージを識別するIDの一覧です。 |
| `compressedSummary` | 圧縮要約 | 任意 | `object（主な項目: summaryId, version, content, coveredMessageIds, tokenCount, updatedAt）` | このデータで管理する「圧縮要約」です。 |
| `durableFacts` | 継続利用する事実 | 必須 | `string[]` | このデータで管理する「継続利用する事実」です。 |
| `temporaryAssumptions` | 一時仮定 | 必須 | `string[]` | このデータで管理する「一時仮定」です。 |
| `decisions` | 判断一覧 | 必須 | `string[]` | このデータで管理する「判断一覧」です。 |
| `unresolvedQuestions` | 未解決質問 | 必須 | `string[]` | このデータで管理する「未解決質問」です。 |
| `referencedCitationIds` | 参照済み引用ID一覧 | 必須 | `string[]` | 複数の参照済み引用を識別するIDの一覧です。 |


圧縮の種類:

| 種類 | 目的 | 内容 |
|---|---|---|
| rolling summary | 古い会話の要点保持 | 条件、決定事項、未解決事項を短く保存 |
| query-focused summary | 現在質問に関係する履歴だけ抽出 | 現在の質問に関係しない雑談や完了済み話題を除外 |
| citation memory | 過去に参照した根拠の再利用 | 前回の文書、ページ、chunk を保持。ただし権限は毎回再確認 |
| task state | 作業状態の保持 | 比較対象、対象文書、検討条件、出力形式などを保存 |



マルチターン検索では、単に履歴を要約するだけでなく、検索可能な独立質問へ変換します。

```text
build_conversation_state:
過去ターンから active topic、entity、参照文書、previous citation、未解決条件を抽出する。

decontextualize_query:
「さっきの件」「この表では？」「続きは？」のような省略質問を、単独で検索可能な standalone question に変換する。

previous citation anchoring:
短い follow-up の場合、直前に使った citation の documentId、page、chunkId、heading を検索 query の anchor にする。

refusal filtering:
assistant の回答不能文、定型の断り文、一般的な前置きは active topic に混ぜない。
```

### 型定義: `ConversationRagState`（会話RAG状態）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ConversationRagState` | 会話RAG状態 | 会話履歴を踏まえて、独立した質問、検索クエリ、前回引用を作るための状態。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `sessionId` | セッションID | 必須 | `string` | セッションIDを一意に識別するためのIDです。 |
| `messageId` | メッセージID | 必須 | `string` | メッセージIDを一意に識別するためのIDです。 |
| `originalUserQuestion` | 元のユーザー質問 | 必須 | `string` | このデータで管理する「元のユーザー質問」です。 |
| `standaloneQuestion` | 独立質問 | 必須 | `string` | このデータで管理する「独立質問」です。 |
| `turnDependency` | 会話依存種別 | 必須 | `"standalone" / "follow_up" / "correction" / "comparison" / "refinement"` | このデータで管理する「会話依存種別」です。 |
| `activeTopics` | 有効トピック一覧 | 必須 | `string[]` | このデータで管理する「有効トピック一覧」です。 |
| `activeEntities` | 有効エンティティ一覧 | 必須 | `string[]` | このデータで管理する「有効エンティティ一覧」です。 |
| `activeDocuments` | 有効文書一覧 | 必須 | `"current_scope" / "previous_citation" / "explicit_user_reference"` | このデータで管理する「有効文書一覧」です。 |
| `previousCitations` | 前回引用一覧 | 必須 | `PreviousCitationAnchor[]` | このデータで管理する「前回引用一覧」です。 |
| `retrievalQueries` | 検索クエリ一覧 | 必須 | `string[]` | このデータで管理する「検索クエリ一覧」です。 |
| `ignoredAssistantMessageIds` | 無視したAIメッセージID一覧 | 任意 | `string[]` | 複数の無視したAIメッセージを識別するIDの一覧です。 |
| `ignoredReason` | 無視理由 | 任意 | `"assistant_refusal" / "boilerplate" / "ungrounded_assistant_text"` | 無視理由を説明し、担当者確認や監査に使います。 |


### 型定義: `PreviousCitationAnchor`（前回引用アンカー）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `PreviousCitationAnchor` | 前回引用アンカー | 前の回答で使った引用を、次の検索の手がかりとして保持する情報。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `citationId` | 引用ID | 必須 | `string` | 引用IDを一意に識別するためのIDです。 |
| `documentId` | 文書ID | 必須 | `string` | 文書IDを一意に識別するためのIDです。 |
| `chunkId` | チャンクID | 必須 | `string` | チャンクIDを一意に識別するためのIDです。 |
| `page` | ページ | 任意 | `number` | ページを数値で管理します。 |
| `headingPath` | 見出しパス | 任意 | `string[]` | このデータで管理する「見出しパス」です。 |
| `quoteHash` | 引用ハッシュ | 任意 | `string` | このデータで管理する「引用ハッシュ」です。 |


memory card の扱い:

```text
- memory card は検索改善用の clue / expansion source として扱う。
- memory summary 自体を final citation にしない。
- memory hit は sourceChunkIds / page range に展開してから final context に入れる。
- memory metadata に残る文書・chunk は、回答時に必ず再認可する。
```

### 型定義: `ConversationMemoryCard`（会話メモリカード）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ConversationMemoryCard` | 会話メモリカード | 会話内で再利用する要点。最終引用ではなく、元チャンクへ展開して使う。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `memoryCardId` | メモリカードID | 必須 | `string` | メモリカードIDを一意に識別するためのIDです。 |
| `sessionId` | セッションID | 必須 | `string` | セッションIDを一意に識別するためのIDです。 |
| `summary` | 要約 | 必須 | `string` | このデータで管理する「要約」です。 |
| `sourceChunkIds` | 元チャンクID一覧 | 必須 | `string[]` | 複数の元チャンクを識別するIDの一覧です。 |
| `pageStart` | 開始ページ | 任意 | `number` | 開始ページを数値で管理します。 |
| `pageEnd` | 終了ページ | 任意 | `number` | 終了ページを数値で管理します。 |
| `documentIds` | 文書ID一覧 | 必須 | `string[]` | 複数の文書を識別するIDの一覧です。 |
| `memoryType` | メモリ種別 | 必須 | `"topic" / "entity" / "citation_anchor" / "task_state"` | このデータで管理する「メモリ種別」です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


マルチターン時の不変条件:

```text
- assistant 発話を根拠文書の代わりに使わない。
- assistant の過去回答が citation を持つ場合でも、回答時には source chunk を再取得し直す。
- previous citation は検索 anchor であり、権限確認・品質確認・score gate を省略する理由にならない。
- refusal 文や「資料が見つかりませんでした」という定型文を topic として保持しない。
- compressed summary は会話状態であり、document citation ではない。
```

圧縮時の禁止事項:

```text
- 権限外文書名を summary に混ぜる
- LLM の内部推論を summary として保存する
- 一時条件を恒久的な個人設定として保存する
- citation の権限再確認を省略する
```

関連研究・採用方針:

```text
Lost in the Middle:
長い context に単純投入すると中間情報が使われにくいという知見を踏まえ、全履歴投入ではなく構造化圧縮と retrieval を使う。

LLMLingua / LongLLMLingua:
prompt compression の考え方を参考に、古い会話や長大 evidence を query に応じて圧縮する。

MemGPT 系の memory 管理:
短期 memory、長期 memory、作業 memory を分ける考え方を参考に、会話状態を recent / summary / task state に分離する。

QReCC / conversational query rewriting:
過去ターンを踏まえた省略質問を、検索可能な独立クエリに書き換える。
```

------

## 4.12 チャット内処理フロー

チャット送信後は、RAG、回答生成、ツール実行を **チャット内オーケストレーション** として扱います。

```text
1. ユーザーが質問、回答範囲、モデルを指定する。
2. chat:create と対象 resource permission を確認する。
3. 会話状態を読み込む。
4. 必要に応じて会話履歴を圧縮・更新する。
5. 質問を検索向けに正規化・書き換える。
6. RAG検索が必要か、ツールが必要か、回答不能判定が必要かを決める。
7. RAG検索、quality policy、rerank、evidence selection を実行する。
8. 必要に応じて document / drawing / quality / parse / support / debug tool を実行する。
9. authorized and quality-approved evidence と tool output summary だけを回答生成へ渡す。
10. groundedness check と quality warning 判定を行う。
11. 回答、citation、または answer_unavailable を返す。
12. ChatOrchestrationRun と DebugTrace を保存する。
```

チャット内オーケストレーションは、非同期エージェント実行とは別です。

```text
チャット内オーケストレーション:
その場で回答を返すための短時間の処理。

非同期エージェント実行:
Claude Code / Codex / OpenCode 等を使い、長時間・複数ファイル・成果物生成を伴う処理。
```

------

## 4.13 チャットの品質改善方針

チャット品質は、次の技術方針で改善します。

| 課題 | 方針 | 参考にする研究・手法 |
|---|---|---|
| 質問語と資料語のズレ | query rewrite, HyDE, 検索語対応づけ | HyDE, query expansion, conversational query rewriting |
| 検索漏れ | BM25 + dense retrieval + metadata filter + fusion | DPR, ColBERT, hybrid retrieval, RRF |
| 上位結果の精度 | cross-encoder / LLM rerank | monoT5, cross-encoder reranking |
| 長大PDF | 階層 chunk、親子 chunk、章節 metadata、要約 index | RAPTOR, parent-child retrieval, LongRAG 系 |
| 図面QA | title block / layer / bbox / OCR / sheet render の併用 | Document AI, DocVQA, layout-aware retrieval |
| 回答の根拠性 | authorized and quality-approved evidence 限定、citation、groundedness check | RAG, Self-RAG, RAGAS |
| 長い会話 | rolling summary、query-focused compression、state management | Lost in the Middle, LLMLingua, MemGPT |

------

## 4.14 チャット追加受け入れ条件

```text
AC-CHAT-011:
チャット内 RAG、回答生成、ツール実行は ChatOrchestrationRun として記録される。

AC-CHAT-012:
長い会話では、直近 raw message と構造化 summary を組み合わせて利用する。

AC-CHAT-013:
会話 summary に権限外文書名、内部 policy、LLM の内部推論を保存しない。

AC-CHAT-014:
過去 citation を再利用する場合でも、回答時に resource permission を再確認する。

AC-CHAT-015:
マルチターンの省略質問は、検索前に独立クエリへ書き換えられる。

AC-CHAT-016:
500ページ超PDFでは、ページ、章節、表、図、親子 chunk を citation に紐づけられる。

AC-CHAT-017:
図面QAでは、図面 metadata と OCR / title block / layer 情報を検索・回答に利用できる。
```

------

# 4A. チャット内RAG・回答生成

## 4A.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| RAG | 検索拡張生成 | 文書検索で見つけた根拠を使ってAIが回答する方式。 |
| Evidence | 根拠 | 回答生成に使う文書チャンク、表、図、計算済み事実など。 |
| Authorized evidence | 認可済み根拠 | ユーザーが閲覧権限を持つ根拠。 |
| Quality-approved evidence | 品質承認済み根拠 | 鮮度、検証、抽出品質などの品質条件を満たした根拠。 |
| Groundedness | 根拠整合性 | 回答文が根拠に支えられている度合い。 |
| AnswerSpan | 回答スパン | 回答中の一部分がどの根拠に対応するかを示す細かい単位。 |
| usedSpans | 利用スパン | 実際に回答に使った回答スパンの一覧。 |
| RequiredFact | 必須事実 | 質問に答えるために必ず確認すべき事実。 |
| Primary fact | 主事実 | 回答の成立に不可欠な必須事実。 |
| Secondary fact | 補助事実 | 回答を具体化する補助的な事実。 |
| Sufficient Context Gate | 十分文脈判定 | 回答に十分な根拠があるかをANSWERABLE/PARTIAL/UNANSWERABLEで判定する処理。 |
| Answer Support Verifier | 回答支持検証 | 生成後の回答文が引用や計算済み事実で支えられているかを検証する処理。 |
| Answer repair | 回答修復 | 不支持文を検出した後、支持された事実だけで回答を作り直す処理。 |
| Answer unavailable | 回答不能 | 根拠不足、権限不足、品質不足、矛盾などにより安全に回答できない状態。 |
| ComputedFact | 計算済み事実 | 日付差分、閾値比較、金額計算など、根拠からシステムが計算した事実。 |
| PolicyComputation | ポリシー計算 | 規程の条件と質問中の値を比較し、可否・要否・警告を判断する計算。 |
| TypedClaim | 型付き主張 | 文書内の主張を主語・述語・値・範囲・有効日などで構造化したもの。 |
| RiskSignal | リスクシグナル | 金額、期限、値の食い違いなど、誤回答につながる可能性のサイン。 |
| Final answer context | 最終回答文脈 | LLMに回答生成用として渡す最終的な根拠セット。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| RagQueryRun | RAG検索実行 | 検索計画、検索結果、rerank、回答生成、traceを管理する。 |
| SearchPlan | 検索計画 | 検索クエリ、対象範囲、検索方式、必要な事実を管理する。 |
| RetrievalRiskSignal | 検索リスクシグナル | 矛盾や値の食い違いなど追加確認すべき兆候を管理する。 |
| RetrievedEvidence | 検索された根拠候補 | 検索で取得したchunk、score、品質、citation情報を管理する。 |
| AnswerSpan | 回答スパン | 回答内の部分表現と根拠の対応を管理する。 |
| ComputedFact | 計算済み事実 | 計算・閾値比較と支持根拠を管理する。 |
| RagAnswer | RAG回答 | 回答本文、citation、回答不能理由、品質警告を管理する。 |
| AnswerUnavailableReason | 回答不能理由 | 回答不能にした理由を分類する。 |
| AnswerUnavailableEvent | 回答不能イベント | 回答不能の発生と担当者対応への接続を管理する。 |
| RequiredFact | 必須事実 | 質問に答えるために必要な事実を構造化する。 |
| FactSupport | 事実支持結果 | 必須事実が根拠に支えられているかを表す。 |
| SufficientContextJudgement | 十分文脈判定 | 回答可能性の判定結果を管理する。 |
| AnswerSupportJudgement | 回答支持判定 | 生成後回答の各文が根拠で支持されるかを管理する。 |
| TypedClaim | 型付き主張 | 矛盾検出用の構造化主張を管理する。 |
| PolicyComputation | ポリシー計算 | 条件比較、効果、根拠を管理する。 |
| RetrievalProfile | 検索プロファイル | topK、閾値、追加検索条件を管理する。 |
| ContextBudgetProfile | 文脈予算プロファイル | 最終回答文脈の件数、token、優先順位を管理する。 |

### 守るべきルール
- LLMに渡す根拠はauthorized evidenceかつquality-approved evidenceに限定する。
- primary factがmissingまたはconflictingなら原則answer_unavailableにする。
- PARTIALはprimary factが支持されている場合のみ後段へ進める。
- 生成後はAnswer Support Verifierで不支持文を検出し、必要ならsupported-only repairを行う。
- computedFactsは文書citationとは別の根拠種別として扱い、supportingEvidenceIdsを持たせる。
- memory summaryや過去assistant発話を最終citationにしない。
- 低score chunkはfinal answer contextに入れない。

### 実行すべき処理
1. 質問からRequiredFactを計画し、検索クエリを作る。
2. 権限、品質、鮮度、検証状態で検索対象を絞る。
3. lexical search、vector search、fusion、rerankを実行する。
4. Sufficient Context Gateで回答可能性を判定する。
5. 回答を生成し、citation validationとAnswer Support Verifierを実行する。
6. 不支持文がある場合は回答修復を行い、再検証する。
7. 根拠不足・矛盾・品質不足ならanswer_unavailableを返す。

### UI
- 回答本文、citation、品質警告、回答不能理由を利用者に表示する。
- 回答不能時は問い合わせ作成、検索範囲変更、文書追加、担当者確認の導線を出す。
- 運用者向けdebugでは、権限範囲内で検索件数、除外理由、support判定を確認できる。

------

## 4A.1 目的

チャット内RAG・回答生成は、利用者が閲覧可能な資料だけを根拠として、チャット回答を生成する内部機能です。

```text
チャット内RAG回答 =
  質問理解
  + 検索範囲の確定
  + 権限内検索
  + 根拠選択
  + 回答生成
  + citation
  + 回答不能判定
```

LLM は権限判定をしません。LLM に渡す前に、検索対象と根拠をアプリケーション側で確定します。

------

## 4A.2 RAG query run

### 型定義: `RagQueryRun`（RAG検索実行）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `RagQueryRun` | RAG検索実行 | 1つの質問に対する検索、再ランキング、回答生成までの実行単位。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `ragRunId` | RAG実行ID | 必須 | `string` | RAG実行IDを一意に識別するためのIDです。 |
| `tenantId` | テナントID | 必須 | `string` | テナントIDを一意に識別するためのIDです。 |
| `sessionId` | セッションID | 必須 | `string` | セッションIDを一意に識別するためのIDです。 |
| `messageId` | メッセージID | 必須 | `string` | メッセージIDを一意に識別するためのIDです。 |
| `requesterUserId` | 依頼者ユーザーID | 必須 | `string` | 依頼者ユーザーIDを一意に識別するためのIDです。 |
| `searchScope` | 検索範囲 | 必須 | `SearchScope` | 処理や設定を適用する検索範囲を示します。 |
| `normalizedSearchScope` | 正規化検索範囲 | 必須 | `SearchScope` | 処理や設定を適用する正規化検索範囲を示します。 |
| `status` | 状態 | 必須 | `"queued" / "searching" / "reranking" / "generating" / "completed" / "answer_unavailable" / "failed"` | 対象の現在の状態を示します。 |
| `retrieverVersion` | retrieverバージョン | 必須 | `string` | 利用したretrieverバージョンを記録し、再実行や差分確認に使います。 |
| `rerankerVersion` | 再ランキング器バージョン | 任意 | `string` | 利用した再ランキング器バージョンを記録し、再実行や差分確認に使います。 |
| `promptVersion` | プロンプトバージョン | 必須 | `string` | 利用したプロンプトバージョンを記録し、再実行や差分確認に使います。 |
| `modelId` | モデルID | 必須 | `string` | モデルIDを一意に識別するためのIDです。 |
| `indexVersion` | インデックスバージョン | 任意 | `string` | 利用したインデックスバージョンを記録し、再実行や差分確認に使います。 |
| `runtimePolicyVersion` | 実行ポリシーバージョン | 任意 | `string` | 利用した実行ポリシーバージョンを記録し、再実行や差分確認に使います。 |
| `answerPolicyVersion` | 回答ポリシーバージョン | 任意 | `string` | 利用した回答ポリシーバージョンを記録し、再実行や差分確認に使います。 |
| `contextPolicyVersion` | 文脈ポリシーバージョン | 任意 | `string` | 利用した文脈ポリシーバージョンを記録し、再実行や差分確認に使います。 |
| `answerStyle` | 回答スタイル | 任意 | `"standard" / "grounded_short" / "benchmark_grounded_short"` | このデータで管理する「回答スタイル」です。 |
| `answerabilityStatus` | 回答可否状態 | 任意 | `"answerable" / "partial" / "unanswerable"` | 対象の現在の回答可否状態を示します。 |
| `metrics` | 指標 | 任意 | `object（主な項目: searchLatencyMs, generationLatencyMs, totalLatencyMs, retrievedChunkCount, authorizedChunkCount, usedCitationCount）` | このデータで管理する「指標」です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `completedAt` | 完了日時 | 任意 | `string` | 完了日時を記録します。 |


`RagQueryRun` は、ChatOrchestrationRun の内部ステップとして作成されます。検索テスト、問い合わせ分析、ベンチマークでも同じ構造を再利用します。

------

## 4A.3 検索計画

### 型定義: `SearchPlan`（検索計画）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `SearchPlan` | 検索計画 | 質問に対して、どの検索語・検索方式・検索範囲を使うかを決めた計画。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `ragRunId` | RAG実行ID | 必須 | `string` | RAG実行IDを一意に識別するためのIDです。 |
| `originalQuery` | 元クエリ | 必須 | `string` | このデータで管理する「元クエリ」です。 |
| `normalizedQuery` | 正規化クエリ | 必須 | `string` | このデータで管理する「正規化クエリ」です。 |
| `queryType` | 質問種別 | 必須 | `"fact_lookup" / "procedure" / "comparison" / "summarization" / "troubleshooting" / "other"` | このデータで管理する「質問種別」です。 |
| `rewrittenQueries` | 書き換えクエリ一覧 | 必須 | `string[]` | このデータで管理する「書き換えクエリ一覧」です。 |
| `expansionTerms` | 展開語一覧 | 必須 | `string[]` | このデータで管理する「展開語一覧」です。 |
| `decontextualizedQuery` | 文脈独立化クエリ | 任意 | `string` | 文脈独立化クエリとして表示または処理する文字列です。 |
| `turnDependency` | 会話依存種別 | 任意 | `"standalone" / "follow_up" / "correction" / "comparison" / "refinement"` | このデータで管理する「会話依存種別」です。 |
| `previousCitationAnchors` | 前回引用アンカー一覧 | 任意 | `PreviousCitationAnchor[]` | このデータで管理する「前回引用アンカー一覧」です。 |
| `requiredFacts` | 必須事実 | 任意 | `RequiredFact[]` | 必須事実を有効にするか、条件を満たすかを示します。 |
| `searchMethods` | 検索方式一覧 | 必須 | `"lexical" / "semantic" / "metadata_filter" / "rerank"` | このデータで管理する「検索方式一覧」です。 |
| `topK` | 取得件数 | 必須 | `number` | 取得件数を数値で管理します。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |


検索改善で公開された言い換えルールは `expansionTerms` に反映できます。ただし、検索改善ルールは閲覧権限を拡張しません。

------

## 4A.4 検索パイプライン

```text
1. ユーザー active 確認
2. chat:create 確認
3. searchScope 正規化
4. 対象 folder / document / temporaryScope の resource permission 確認
5. build_conversation_state で会話状態、previous citation、turnDependency を作る
6. decontextualize_query で省略質問を standalone question に変換する
7. question_requirement_slot を検出する
8. RequiredFact / structured fact plan を作る
9. active 文書だけに絞る
10. quality policy で RAG利用可能文書に絞る
11. freshness policy で古い文書を制御する
12. verification policy で未検証文書を制御する
13. extraction quality policy で OCR / 表 / 図 / レイアウト低信頼文書を制御する
14. query rewrite / expansion を行う
15. lexical search と semantic vector search を実行する
16. metadata filter を適用する
17. 検索ヒットを manifest / folder permission / quality profile で再確認する
18. fusion / rerank を行う
19. retrieval evaluator で fact coverage、riskSignals、claim conflict 候補を評価する
20. answerability_gate と sufficient_context_gate で ANSWERABLE / PARTIAL / UNANSWERABLE を判定する
21. final answer context selection で minScore filter、diversity、previous citation anchor を反映する
22. LLM に authorized and quality-approved evidence と computedFacts のみ渡す
23. extractive-first / source wording 優先で回答を生成する
24. validate_citations で citation と質問要求 slot の充足を検証する
25. verify_answer_support で各回答文が evidence / computedFacts に支持されるか検証する
26. 不支持文がある場合は supported-only answer repair を行い、再検証する
27. quality warning / 回答 / 回答不能 / 担当者対応導線を返す
28. citation、usedSpans、computedFacts、debug trace を sanitize して保存する
```

検索ヒットがあっても、回答に十分な根拠がない場合は回答不能にします。

------


## 4A.4A 現行 MemoRAG pipeline との対応

実装済みの MemoRAG pipeline は、仕様上の「検索パイプライン」を次の処理ノードに分解して扱います。
ノード名は実装・ログ・ベンチマークで追跡できるようにし、閾値や fallback は `runtime policy` として一箇所に集約します。

```text
1. user_status_check
2. feature_permission_check
3. search_scope_normalize
4. resource_permission_filter
5. build_conversation_state
6. decontextualize_query
7. question_requirement_slot_detect
8. structured_fact_planning
9. lifecycle_filter
10. quality_policy_filter
11. query_rewrite
12. lexical_search
13. vector_search
14. hybrid_fusion
15. manifest_permission_recheck
16. rerank
17. retrieval_evaluator
18. answerability_gate
19. sufficient_context_gate
20. final_answer_context_select
21. generate_answer
22. validate_citations
23. verify_answer_support
24. supported_only_answer_repair
25. finalize_response_or_refusal
```

運用方針です。

```text
- 各 node は run trace に開始時刻、終了時刻、件数、失敗理由を残す。
- 閾値はコード内に散在させず、runtime policy と環境設定で管理する。
- policy 変更は embedding 再計算を必要としない範囲と、再インデックスが必要な範囲を分ける。
- ベンチマークでは node 別 latency、drop 件数、answer_unavailable 理由を集計する。
```

受け入れ条件です。

```text
AC-RAG-PIPELINE-001:
RAG run trace には pipeline node ごとの入出力件数、latency、失敗理由を保存できる。

AC-RAG-PIPELINE-002:
runtime policy の閾値変更は、変更者、変更前後、理由を監査ログに残す。

AC-RAG-PIPELINE-003:
品質・権限・ライフサイクルによる除外は、利用者向けには存在を示唆せず、operator_sanitized 以上で確認できる。
```



## 4A.4B 回答生成パイプライン詳細

回答生成まわりは、検索、回答可否、生成後検証を分離します。
検索ヒットがあることと、回答してよいことは別です。

```text
マルチターン前処理:
  build_conversation_state
    -> decontextualize_query
    -> previous citation anchored retrieval queries

回答要件計画:
  question_requirement_slot_detect
    -> structured_fact_planning
    -> RequiredFact[]

検索・文脈選択:
  retrieval
    -> rerank
    -> retrieval_evaluator
    -> final_answer_context_select

回答可否:
  answerability_gate
    -> sufficient_context_gate

回答生成・検証:
  generate_answer
    -> validate_citations
    -> verify_answer_support
    -> supported_only_answer_repair
    -> verify_answer_support
    -> finalize_response_or_refusal
```

`answerability_gate` は cheap precheck として扱い、明らかな無根拠・対象外・権限外 scope を早期に止めます。
`sufficient_context_gate` は LLM judge を使い、RequiredFact の支持状況、primary fact の有無、conflict を見て `ANSWERABLE / PARTIAL / UNANSWERABLE` を判定します。

`PARTIAL` の扱い:

```text
後段に進めてよい PARTIAL:
- primary fact が supported
- missing が secondary fact に限られる
- primary fact に conflict がない
- final answer context に citation 可能な根拠がある

拒否に倒す PARTIAL:
- primary fact が missing
- primary fact が conflicting
- 必須の数値・日付・固有名詞が根拠にない
- 低信頼 OCR / 表抽出だけが根拠
- retrieval evaluator が no_coverage / conflict_primary を返す
```

final answer context selection の方針:

```text
- rerank 後に minScore 未満の chunk を回答 context から除外する。
- simple high-confidence evidence が十分に揃った場合は、不要な追加検索を止める。
- low score chunk は citation 候補にも回答 context にも入れない。
- long document では章節・親子chunk・page range の diversity を確保する。
- 表・図・OCR block は extractionQualityStatus と block confidence を再確認する。
```

`riskSignals` は即拒否ではなく、追加検索・conflict judge・回答不能判定への routing signal として扱います。

### 型定義: `RetrievalRiskSignal`（検索リスクシグナル）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `RetrievalRiskSignal` | 検索リスクシグナル | 金額・期限などの矛盾可能性や追加検索が必要な兆候。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `signalType` | シグナル種別 | 必須 | `"value_mismatch" / "date_mismatch" / "amount_mismatch" / "unit_mismatch" / "scope_mismatch" / "possible_conflict" / "low_context_coverage"` | このデータで管理する「シグナル種別」です。 |
| `severity` | 重要度 | 必須 | `"low" / "medium" / "high"` | このデータで管理する「重要度」です。 |
| `relatedFactIds` | 関連事実ID一覧 | 任意 | `string[]` | 複数の関連事実を識別するIDの一覧です。 |
| `relatedChunkIds` | 関連チャンクID一覧 | 任意 | `string[]` | 複数の関連チャンクを識別するIDの一覧です。 |
| `routing` | 振り分け | 必須 | `"continue" / "additional_search" / "conflict_judge" / "answer_unavailable"` | このデータで管理する「振り分け」です。 |


## 4A.5 evidence

### 型定義: `RetrievedEvidence`（検索された根拠候補）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `RetrievedEvidence` | 検索された根拠候補 | 検索で見つかったチャンクと、そのスコアや品質警告。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `evidenceId` | 根拠ID | 必須 | `string` | 根拠IDを一意に識別するためのIDです。 |
| `ragRunId` | RAG実行ID | 必須 | `string` | RAG実行IDを一意に識別するためのIDです。 |
| `chunkId` | チャンクID | 必須 | `string` | チャンクIDを一意に識別するためのIDです。 |
| `documentId` | 文書ID | 必須 | `string` | 文書IDを一意に識別するためのIDです。 |
| `folderId` | フォルダID | 必須 | `string` | フォルダIDを一意に識別するためのIDです。 |
| `score` | スコア | 必須 | `number` | スコアを数値で管理します。 |
| `rerankScore` | 再ランキングスコア | 任意 | `number` | 再ランキングスコアを数値で管理します。 |
| `quote` | 引用抜粋 | 必須 | `string` | このデータで管理する「引用抜粋」です。 |
| `page` | ページ | 任意 | `number` | ページを数値で管理します。 |
| `headingPath` | 見出しパス | 任意 | `string[]` | このデータで管理する「見出しパス」です。 |
| `tableId` | 表ID | 任意 | `string` | 表IDを一意に識別するためのIDです。 |
| `figureId` | 図ID | 任意 | `string` | 図IDを一意に識別するためのIDです。 |
| `qualityProfile` | 品質プロファイル | 任意 | `"eligible" / "eligible_with_warning" / "restricted" / "excluded"` | このデータで管理する「品質プロファイル」です。 |
| `usedForAnswer` | 回答利用有無 | 必須 | `boolean` | 回答利用有無を有効にするか、条件を満たすかを示します。 |


`RetrievedEvidence` は権限内かつ品質ポリシー通過済みの chunk のみ保持します。権限外文書の存在や件数、品質ポリシーにより除外された権限外文書の詳細は、利用者向けログ・debug trace・問い合わせ詳細に出しません。



citation grounding と answer span grounding は別概念として扱います。

```text
citation grounding:
回答で参照する文書、ページ、chunk、表、図を示す。

answer span grounding:
回答中の主要事実が、根拠 sentence のどの範囲から来たかを示す。
```

### 型定義: `AnswerSpan`（回答スパン）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `AnswerSpan` | 回答スパン | 回答文の中で、どの範囲がどの根拠に対応しているかを示す細かい対応情報。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `spanId` | スパンID | 必須 | `string` | スパンIDを一意に識別するためのIDです。 |
| `evidenceId` | 根拠ID | 必須 | `string` | 根拠IDを一意に識別するためのIDです。 |
| `chunkId` | チャンクID | 必須 | `string` | チャンクIDを一意に識別するためのIDです。 |
| `documentId` | 文書ID | 必須 | `string` | 文書IDを一意に識別するためのIDです。 |
| `factId` | 事実ID | 任意 | `string` | 事実IDを一意に識別するためのIDです。 |
| `sentenceIndex` | 文番号 | 任意 | `number` | 文番号を数値で管理します。 |
| `sourceText` | 元テキスト | 必須 | `string` | 元テキストとして表示または処理する文字列です。 |
| `answerText` | 回答本文 | 必須 | `string` | 回答本文として表示または処理する文字列です。 |
| `startOffset` | 開始位置 | 任意 | `number` | 開始位置を数値で管理します。 |
| `endOffset` | 終了位置 | 任意 | `number` | 終了位置を数値で管理します。 |
| `page` | ページ | 任意 | `number` | ページを数値で管理します。 |
| `bbox` | 位置座標 | 任意 | `object（主な項目: x, y, width, height）` | このデータで管理する「位置座標」です。 |
| `groundingType` | 根拠種別 | 必須 | `"extractive" / "paraphrased" / "computed_from_source"` | このデータで管理する「根拠種別」です。 |


回答生成では、primary fact について evidence sentence から `AnswerSpan` を抽出し、可能な限り source wording を保持します。
`usedChunkIds` は「どの chunk を使ったか」を示し、`usedSpans` は「どの表現・値を回答に使ったか」を示します。

`computedFacts` は document citation とは別の根拠種別です。
日付計算、期限切れ判定、残日数、金額、割合、合計、差分、閾値条件のように、文書の根拠と質問中の値から system が導出した事実を表します。

### 型定義: `ComputedFact`（計算済み事実）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ComputedFact` | 計算済み事実 | 日付差分、金額計算、閾値比較など、文書根拠からシステムが計算した事実。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `computedFactId` | 計算済み事実ID | 必須 | `string` | 計算済み事実IDを一意に識別するためのIDです。 |
| `factType` | 事実種別 | 必須 | `"date_calculation" / "days_remaining" / "threshold_comparison" / "amount_calculation" / "percentage_calculation" / "sum" / "difference" / "policy_condition"` | このデータで管理する「事実種別」です。 |
| `expression` | 計算式 | 任意 | `string` | このデータで管理する「計算式」です。 |
| `inputs` | 入力値一覧 | 必須 | `object[]（主な項目: label, value, unit, sourceEvidenceId, sourceText）` | このデータで管理する「入力値一覧」です。 |
| `result` | 結果 | 必須 | `string \| number \| boolean` | 結果を数値で管理します。 |
| `unit` | 単位 | 任意 | `string` | このデータで管理する「単位」です。 |
| `comparator` | 比較演算子 | 任意 | `"lt" / "lte" / "gt" / "gte" / "eq" / "neq"` | このデータで管理する「比較演算子」です。 |
| `threshold` | 閾値 | 任意 | `string \| number` | 閾値を数値で管理します。 |
| `satisfiesCondition` | 条件を満たすか | 任意 | `boolean` | 条件を満たすかを有効にするか、条件を満たすかを示します。 |
| `effect` | 効果 | 任意 | `"allowed" / "denied" / "required" / "not_required" / "warning"` | このデータで管理する「効果」です。 |
| `supportingEvidenceIds` | 支持根拠ID一覧 | 必須 | `string[]` | 複数の支持根拠を識別するIDの一覧です。 |
| `confidence` | 信頼度 | 必須 | `number` | 信頼度を数値で管理します。 |


computedFacts の利用ルール:

```text
- computedFacts は supportingEvidenceIds を必ず持つ。
- computedFacts だけで文書根拠のない回答を作らない。
- threshold_comparison では comparator、threshold、satisfiesCondition、effect を明示する。
- 回答本文では、文書に書かれた条件と system が計算した結果を混同しない。
```

------

## 4A.6 回答生成ポリシー

回答生成では次を守ります。

```text
- 根拠にないことを断定しない
- citation なしの重要主張を避ける
- expired 文書を現在の根拠として使わない
- superseded 文書を最新版として扱わない
- unverified 文書を正式根拠として断定しない
- OCR信頼度が低い箇所を断定しない
- 表から回答する場合は、列名・行名・単位を確認する
- 図から回答する場合は、図のcaptionまたは説明を citation に含める
- 複数文書が矛盾する場合は、矛盾として明示する
- 最新性が重要な質問では、文書の日付や更新日を示す
- 権限外資料の存在を推測しない
- 品質条件を満たす根拠が不足する場合は answer_unavailable にする
- 回答不能時は、理由と次のアクションを返す
```



追加の回答生成規則:

```text
extractive-first answer span:
primary fact は evidence sentence から answer span を抽出し、source wording を優先する。
要約・言い換えは許可するが、数値、日付、固有名詞、制度名、図面番号、表の列名・単位は原文表現を保持する。

question requirement slot:
質問が要求する slot を省略しない。
初期 slot は date、place、organization、person、section、item、term、count、reason、condition、yes_no、amount、unit とする。

source-only answer:
文書根拠または computedFacts にない補足説明を混ぜない。
社内相談QAでは一般論と社内資料の根拠を分ける。

computedFacts:
日付、期限、金額、割合、閾値条件は computedFacts を使い、文書根拠と system-derived evidence を分ける。

benchmark_grounded_short:
benchmark corpus / runner 経路では、reference answer に近い短答、資料外補足禁止、会話履歴由来補足禁止、固定 refusal 文言を使う。
dataset 固有 row id ではなく benchmark metadata によって切り替える。
```

質問要求 slot の初期定義:

| slot | 例 | 回答時の確認 |
|---|---|---|
| `date` | いつ、期限、発生日 | 日付または期間を回答に含める |
| `place` | どこ、場所 | 場所・拠点・住所を省略しない |
| `organization` | どの部署、どの会社 | 組織名を回答に含める |
| `section` | 何条、どの章 | 条項、見出し、ページ、表IDを citation と合わせる |
| `item` | 何項目、対象は何 | list count と項目名を照合する |
| `reason` | なぜ、理由 | 根拠の条件・例外を示す |
| `yes_no` | できるか、必要か | 可否と条件を分ける |
| `amount` / `unit` | 金額、数量、単位 | 数値、単位、表の列名を保持する |

post-generation verification:

```text
1. validate_citations:
   citation が回答文を支えているか、質問要求 slot を満たしているか確認する。

2. verify_answer_support:
   回答文ごとに、cited evidence または computedFacts に支持されるか確認する。

3. supported-only answer repair:
   不支持文がある場合、支持された事実だけで回答を修復する。

4. re-verify:
   修復後に再度 verify_answer_support を実行する。

5. finalize:
   不支持文が残る場合は、回答不能または担当者確認に倒す。
```

回答フォーマットは、通常回答と回答不能を分けます。

### 型定義: `RagAnswer`（RAG回答）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `RagAnswer` | RAG回答 | 根拠付き回答本文、引用、利用チャンク、計算済み事実、回答可否をまとめた結果。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `status` | 状態 | 必須 | `"answered" / "answer_unavailable"` | 対象の現在の状態を示します。 |
| `content` | 本文 | 必須 | `string` | 本文として表示または処理する文字列です。 |
| `citations` | 引用一覧 | 必須 | `Citation[]` | このデータで管理する「引用一覧」です。 |
| `usedChunkIds` | 利用チャンクID一覧 | 任意 | `string[]` | 複数の利用チャンクを識別するIDの一覧です。 |
| `usedSpans` | 利用スパン一覧 | 任意 | `AnswerSpan[]` | 利用スパン一覧を有効にするか、条件を満たすかを示します。 |
| `computedFacts` | 計算済み事実一覧 | 任意 | `ComputedFact[]` | このデータで管理する「計算済み事実一覧」です。 |
| `answerStyle` | 回答スタイル | 任意 | `"standard" / "grounded_short" / "benchmark_grounded_short"` | このデータで管理する「回答スタイル」です。 |
| `answerability` | 回答可否 | 任意 | `SufficientContextJudgement` | このデータで管理する「回答可否」です。 |
| `supportVerification` | 支持検証結果 | 任意 | `AnswerSupportJudgement` | このデータで管理する「支持検証結果」です。 |
| `warnings` | 警告一覧 | 任意 | `"stale_evidence" / "unverified_evidence" / "partial_context" / "computed_fact_used" / "table_or_ocr_uncertainty"` | 注意が必要な警告一覧を記録します。 |
| `followUpActions` | 追従追質問actions | 任意 | `FollowUpAction[]` | このデータで管理する「追従追質問actions」です。 |


------

## 4A.7 回答不能判定

### 型定義: `AnswerUnavailableReason`（回答不能理由）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `AnswerUnavailableReason` | 回答不能理由 | 根拠不足、権限不足、品質不足、質問曖昧など、回答できない理由の分類。 |

| 英名（値） | 日本語名 | 内容 |
|---|---|---|
| `no_authorized_documents` | 閲覧可能文書なし | ユーザー権限内に回答対象文書がない。 |
| `no_search_results` | 検索結果なし | 検索しても根拠候補が見つからない。 |
| `insufficient_evidence` | 根拠不足 | 回答に必要な根拠が不足している。 |
| `ambiguous_question` | 質問曖昧 | 質問が曖昧で回答不能になった。 |
| `unsupported_request` | 未対応依頼 | 現在の機能では対応できない依頼。 |
| `tool_required_but_not_allowed` | 必要ツール利用不可 | 回答に必要なツールを権限や設定上利用できない。 |
| `permission_denied_scope` | 検索範囲権限なし | 指定された検索範囲に対する閲覧権限がない。 |
| `temporary_attachment_failed` | 一時添付失敗 | 一時添付の取り込みまたは参照に失敗した。 |
| `quality_policy_excluded` | 品質ポリシー除外 | 品質ポリシーにより根拠候補から除外された。 |
| `expired_only_evidence` | 期限切れ根拠のみ | 見つかった根拠が期限切れ文書だけだった。 |
| `superseded_only_evidence` | 置き換え済み根拠のみ | 見つかった根拠が旧版文書だけだった。 |
| `unverified_high_risk_evidence` | 高リスク未検証根拠 | 高リスク領域で未検証の根拠しかない。 |
| `low_ocr_confidence` | OCR低信頼 | OCR結果の信頼度が低い。 |
| `table_extraction_uncertain` | 表抽出不確実 | 表抽出の信頼性が低く断定回答できない。 |
| `figure_analysis_uncertain` | 図解析不確実 | 図の解析結果が不確実で断定回答できない。 |
| `parse_quality_failed` | 解析品質不合格 | 文書解析品質が基準を満たさない。 |
| `system_error` | システムエラー | システム内部のエラーで回答できない。 |


### 型定義: `AnswerUnavailableEvent`（回答不能イベント）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `AnswerUnavailableEvent` | 回答不能イベント | 回答不能になった質問、理由、担当者対応への接続情報を保持する。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `eventId` | イベントID | 必須 | `string` | イベントIDを一意に識別するためのIDです。 |
| `ragRunId` | RAG実行ID | 必須 | `string` | RAG実行IDを一意に識別するためのIDです。 |
| `sessionId` | セッションID | 必須 | `string` | セッションIDを一意に識別するためのIDです。 |
| `messageId` | メッセージID | 必須 | `string` | メッセージIDを一意に識別するためのIDです。 |
| `reason` | 理由 | 必須 | `AnswerUnavailableReason` | 理由を説明し、担当者確認や監査に使います。 |
| `userVisibleMessage` | 利用者向けメッセージ | 必須 | `string` | 利用者向けメッセージとして表示または処理する文字列です。 |
| `sanitizedDiagnostics` | 無害化済み診断情報 | 任意 | `object（主な項目: searchScopeLabel, authorizedDocumentCount, retrievedChunkCount, qualityRelated, qualityFlags）` | 無害化済み診断情報を有効にするか、条件を満たすかを示します。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |




回答不能判定は、自然文の `requiredFacts` だけでなく、fact id、necessity、type、scope を持つ構造で扱います。

### 型定義: `RequiredFact`（必須事実）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `RequiredFact` | 必須事実 | 質問に答えるために必ず確認すべき事実。主事実と補助事実に分ける。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `factId` | 事実ID | 必須 | `string` | 事実IDを一意に識別するためのIDです。 |
| `necessity` | 必要度 | 必須 | `"primary" / "secondary"` | このデータで管理する「必要度」です。 |
| `factType` | 事実種別 | 必須 | `"date" / "amount" / "person" / "organization" / "place" / "policy_condition" / "procedure_step" / "definition" / "list_item" / "yes_no" / "comparison" / "other"` | このデータで管理する「事実種別」です。 |
| `description` | 説明 | 必須 | `string` | このデータで管理する「説明」です。 |
| `subject` | 主語・対象 | 任意 | `string` | このデータで管理する「主語・対象」です。 |
| `predicate` | 述語・関係 | 任意 | `string` | このデータで管理する「述語・関係」です。 |
| `scope` | 適用範囲 | 任意 | `string` | 処理や設定を適用する適用範囲を示します。 |
| `expectedValueType` | 期待値の型 | 任意 | `"string" / "number" / "date" / "boolean" / "list" / "structured"` | 期待値の型を数値で管理します。 |
| `source` | 発生元 | 必須 | `"planner" / "legacy_fallback" / "manual"` | このデータで管理する「発生元」です。 |


### 型定義: `FactSupportStatus`（事実支持ステータス）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `FactSupportStatus` | 事実支持ステータス | 必須事実が根拠で支持されるか、不足・矛盾しているかを示す。 |

| 英名（値） | 日本語名 | 内容 |
|---|---|---|
| `supported` | 支持あり | 根拠で支えられている。 |
| `partially_supported` | 部分支持 | 一部は根拠で支えられるが不足がある。 |
| `missing` | 不足 | 必要な根拠が見つからない。 |
| `conflicting` | 矛盾 | 根拠同士が矛盾している。 |
| `not_applicable` | 該当なし | この事実には判定を適用しない。 |


### 型定義: `FactSupport`（事実支持結果）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `FactSupport` | 事実支持結果 | 必須事実ごとに、どの根拠または計算済み事実で支えられるかを示す。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `factId` | 事実ID | 必須 | `string` | 事実IDを一意に識別するためのIDです。 |
| `status` | 状態 | 必須 | `FactSupportStatus` | 対象の現在の状態を示します。 |
| `supportingEvidenceIds` | 支持根拠ID一覧 | 必須 | `string[]` | 複数の支持根拠を識別するIDの一覧です。 |
| `supportingComputedFactIds` | 支持計算済み事実ID一覧 | 任意 | `string[]` | 複数の支持計算済み事実を識別するIDの一覧です。 |
| `contradictionEvidenceIds` | contradiction根拠ID一覧 | 任意 | `string[]` | 複数のcontradiction根拠を識別するIDの一覧です。 |
| `explanation` | explanation | 任意 | `string` | このデータで管理する「explanation」です。 |


### 型定義: `SufficientContextJudgement`（十分文脈判定）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `SufficientContextJudgement` | 十分文脈判定 | 回答に十分な根拠があるかを、ANSWERABLE/PARTIAL/UNANSWERABLEで判定する結果。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `judgement` | 判定 | 必須 | `"ANSWERABLE" / "PARTIAL" / "UNANSWERABLE"` | このデータで管理する「判定」です。 |
| `requiredFacts` | 必須事実 | 必須 | `RequiredFact[]` | 必須事実を有効にするか、条件を満たすかを示します。 |
| `factSupports` | 事実支持一覧 | 必須 | `FactSupport[]` | このデータで管理する「事実支持一覧」です。 |
| `primaryFactsSupported` | 主事実支持済み | 必須 | `boolean` | 主事実支持済みを有効にするか、条件を満たすかを示します。 |
| `missingPrimaryFactIds` | 不足主事実ID一覧 | 必須 | `string[]` | 複数の不足主事実を識別するIDの一覧です。 |
| `conflictingPrimaryFactIds` | 矛盾主事実ID一覧 | 必須 | `string[]` | 複数の矛盾主事実を識別するIDの一覧です。 |
| `continueToAnswer` | 回答継続可否 | 必須 | `boolean` | 回答継続可否を有効にするか、条件を満たすかを示します。 |
| `reason` | 理由 | 必須 | `string` | 理由を説明し、担当者確認や監査に使います。 |


structured fact planning の方針:

```text
- planner は factType、subject、scope、expectedValueType を可能な限り埋める。
- planner failure 時は legacy regex / keyword fallback を使える。
- fallback 使用は debug trace に残す。
- 固定 regex は最終判定の主役ではなく、fallback / debug signal として扱う。
```

`PARTIAL` は一律 refusal ではありません。

```text
回答継続:
primary fact が supported で、secondary fact の不足だけが残る場合。

回答不能:
primary fact が missing / conflicting の場合。
高リスク質問で verified/current の primary fact がない場合。
```

回答生成後の support verification は次の contract で保存します。

### 型定義: `AnswerSupportJudgement`（回答支持判定）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `AnswerSupportJudgement` | 回答支持判定 | 生成後の回答文が、引用や計算済み事実で本当に支えられているかを検証する結果。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `judgement` | 判定 | 必須 | `"supported" / "partially_supported" / "unsupported"` | このデータで管理する「判定」です。 |
| `sentenceSupports` | sentencesupports | 必須 | `"supported" / "unsupported" / "contradicted" / "not_checked"` | このデータで管理する「sentencesupports」です。 |
| `unsupportedSentences` | 非支持文一覧 | 必須 | `string[]` | このデータで管理する「非支持文一覧」です。 |
| `contradictionChunkIds` | 矛盾チャンクID一覧 | 任意 | `string[]` | 複数の矛盾チャンクを識別するIDの一覧です。 |
| `repairAttempted` | 修復実施有無 | 必須 | `boolean` | 修復実施有無を有効にするか、条件を満たすかを示します。 |
| `repairSucceeded` | 修復成功有無 | 任意 | `boolean` | 修復成功有無を有効にするか、条件を満たすかを示します。 |
| `repairedAnswerMessageId` | 修復後回答メッセージID | 任意 | `string` | 修復後回答メッセージIDを一意に識別するためのIDです。 |


利用者向けには、権限外文書の存在を示唆しない文言にします。

```text
NG:
権限がないため、該当資料を参照できませんでした。

OK:
現在の回答範囲で参照できる資料内には、十分な根拠が見つかりませんでした。
```

------

## 4A.8 回答不能時の UI

回答不能時は、次を表示します。

```text
- 回答できなかった理由の利用者向け説明
- 現在の回答範囲
- 質問を言い換える導線
- 回答範囲を変更する導線
- 担当者に確認する導線
```

表示例:

```text
現在の回答範囲で参照できる資料内には、十分な根拠が見つかりませんでした。

[質問を言い換える]
[回答範囲を変更]
[担当者に確認する]
```

------

## 4A.9 RAG 機能の受け入れ条件

```text
AC-RAG-001:
RAG回答は authorized evidence かつ quality-approved evidence のみを根拠に生成する。

AC-RAG-002:
検索ヒット後、LLM に渡す前に resource permission と quality policy を再確認する。

AC-RAG-003:
回答に使用した citation はユーザーが readOnly 以上を持つ文書だけに限定する。

AC-RAG-004:
根拠が不足している場合は answer_unavailable を返す。

AC-RAG-005:
answer_unavailable 時に担当者確認へ進める。

AC-RAG-006:
mode=all はユーザーが閲覧可能で、active かつ quality policy を満たす文書だけを対象にする。

AC-RAG-007:
検索改善ルールは検索語を拡張できるが、閲覧権限を拡張しない。

AC-RAG-008:
RagQueryRun には retrieverVersion、promptVersion、modelId を保存する。

AC-RAG-009:
debug trace は権限外文書、権限外フォルダ、内部 policy 情報を含まない。

AC-RAG-010:
回答不能理由は内部 reason と利用者向け message を分けて保存する。

AC-RAG-011:
expired、rejected、excluded_from_rag の文書は evidence selection から除外される。

AC-RAG-012:
superseded 文書は、通常チャットでは evidence selection から除外される。

AC-RAG-013:
高リスク質問で verified/current の根拠がない場合、answer_unavailable を返す。

AC-RAG-014:
未検証文書を根拠に使う場合、回答に未検証である旨を表示する。

AC-RAG-015:
古い文書を根拠に使う場合、回答に更新日または鮮度警告を表示する。

AC-RAG-016:
表から回答する場合、根拠 citation は tableId または表 caption を含む。

AC-RAG-017:
図から回答する場合、根拠 citation は figureId、図 caption、またはページ番号を含む。

AC-RAG-018:
OCR低信頼の箇所だけを根拠に断定回答しない。

AC-RAG-019:
品質条件を満たす根拠が不足する場合、推測回答ではなく answer_unavailable を返す。

AC-RAG-020:
quality_related answer_unavailable から SupportTicket を作成できる。
```

------


## 4A.10 RAG回答時の品質ポリシー

回答生成時のパターンは次です。

| 状況 | 返答 |
|---|---|
| verified / current の十分な根拠がある | 通常回答 |
| stale だが利用許可されている | 警告付き回答 |
| unverified だが利用許可されている | 警告付き回答 |
| expired しかない | 原則 answer_unavailable |
| superseded しかない | 原則 answer_unavailable |
| OCR信頼度が低い | answer_unavailable または担当者確認 |
| 表抽出が不確か | answer_unavailable または担当者確認 |
| 図解析が不確か | answer_unavailable または担当者確認 |
| 矛盾文書がある | 矛盾を明示し、必要に応じて担当者確認 |

RAG trace には、内部向けに品質除外理由を保存できます。ただし、利用者向け trace には、権限外文書、権限外フォルダ、内部 policy、除外された権限外文書件数を表示しません。

```text
内部向けに保存可能:
- quality_filter_excluded_count
- excluded_by_freshness_count
- excluded_by_verification_count
- excluded_by_supersession_count
- excluded_by_extraction_quality_count
- low_ocr_confidence_pages
- table_extraction_issue_tableIds
- figure_analysis_issue_figureIds

利用者向けに表示不可:
- 権限外文書名
- 権限外フォルダ名
- 権限外文書の品質状態
- 内部 policy の詳細
```

------


## 4A.11 型付き claim・矛盾判定・policy computation

矛盾検出は、単なる異なる値の検出ではなく、同一 scope の排他的 claim として扱います。
異なる期間、異なる部署、異なる版、異なる適用条件の値は、直ちに conflict としません。

### 型定義: `TypedClaim`（型付き主張）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `TypedClaim` | 型付き主張 | 文書中の主張を、主語・述語・値・範囲・有効日などで構造化したもの。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `claimId` | 主張ID | 必須 | `string` | 主張IDを一意に識別するためのIDです。 |
| `documentId` | 文書ID | 必須 | `string` | 文書IDを一意に識別するためのIDです。 |
| `chunkId` | チャンクID | 必須 | `string` | チャンクIDを一意に識別するためのIDです。 |
| `subject` | 主語・対象 | 必須 | `string` | このデータで管理する「主語・対象」です。 |
| `predicate` | 述語・関係 | 必須 | `string` | このデータで管理する「述語・関係」です。 |
| `value` | 値 | 必須 | `string \| number \| boolean` | 値を数値で管理します。 |
| `unit` | 単位 | 任意 | `string` | このデータで管理する「単位」です。 |
| `scope` | 適用範囲 | 任意 | `string` | 処理や設定を適用する適用範囲を示します。 |
| `effectiveDate` | 有効日付 | 任意 | `string` | このデータで管理する「有効日付」です。 |
| `effectiveFrom` | 有効開始日 | 任意 | `string` | このデータで管理する「有効開始日」です。 |
| `effectiveTo` | 有効終了日 | 任意 | `string` | このデータで管理する「有効終了日」です。 |
| `sourceText` | 元テキスト | 必須 | `string` | 元テキストとして表示または処理する文字列です。 |
| `confidence` | 信頼度 | 必須 | `number` | 信頼度を数値で管理します。 |


### 型定義: `ClaimConflictJudgement`（主張矛盾判定）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ClaimConflictJudgement` | 主張矛盾判定 | 複数の型付き主張が矛盾するか、範囲違いで矛盾しないかを判定する結果。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `judgement` | 判定 | 必須 | `"no_conflict" / "possible_conflict" / "confirmed_conflict" / "scope_different_no_conflict"` | このデータで管理する「判定」です。 |
| `claimIds` | 主張ID一覧 | 必須 | `string[]` | 複数の主張を識別するIDの一覧です。 |
| `reason` | 理由 | 必須 | `string` | 理由を説明し、担当者確認や監査に使います。 |
| `nextAction` | 次アクション | 必須 | `"continue" / "additional_search" / "show_conflict" / "answer_unavailable" / "human_review"` | このデータで管理する「次アクション」です。 |


value mismatch / date mismatch / amount mismatch は `riskSignals` として検出します。
`riskSignals` は追加検索や conflict judge を起動するための signal であり、単独で即拒否の根拠にはしません。

policy computation は、資料内の条件と質問中の具体値から system が導出する計算・判定です。

### 型定義: `PolicyComputation`（ポリシー計算）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `PolicyComputation` | ポリシー計算 | 条件、比較値、結果効果を使って、規程上の可否や要否を計算する情報。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `policyComputationId` | ポリシー計算ID | 必須 | `string` | ポリシー計算IDを一意に識別するためのIDです。 |
| `relatedFactId` | related事実ID | 任意 | `string` | related事実IDを一意に識別するためのIDです。 |
| `conditionSourceText` | 条件元テキスト | 必須 | `string` | 条件元テキストとして表示または処理する文字列です。 |
| `comparator` | 比較演算子 | 必須 | `"lt" / "lte" / "gt" / "gte" / "eq" / "neq"` | このデータで管理する「比較演算子」です。 |
| `threshold` | 閾値 | 必須 | `string \| number` | 閾値を数値で管理します。 |
| `thresholdUnit` | 閾値単位 | 任意 | `string` | このデータで管理する「閾値単位」です。 |
| `inputValue` | 入力値 | 必須 | `string \| number` | 入力値を数値で管理します。 |
| `inputUnit` | 入力単位 | 任意 | `string` | このデータで管理する「入力単位」です。 |
| `satisfiesCondition` | 条件を満たすか | 必須 | `boolean` | 条件を満たすかを有効にするか、条件を満たすかを示します。 |
| `effect` | 効果 | 必須 | `"allowed" / "denied" / "required" / "not_required" / "warning"` | このデータで管理する「効果」です。 |
| `computedFactId` | 計算済み事実ID | 必須 | `string` | 計算済み事実IDを一意に識別するためのIDです。 |
| `supportingEvidenceIds` | 支持根拠ID一覧 | 必須 | `string[]` | 複数の支持根拠を識別するIDの一覧です。 |


回答本文では、次を分けて表現します。

```text
- 文書に書かれている条件
- ユーザーの質問に含まれる値
- system が計算・比較した結果
- 条件を満たす場合の effect
```

NG:
文書に「今回の申請は承認不要」と書かれているかのように述べる。

OK:
資料には「5万円未満は承認不要」とあります。今回の金額が3万円であれば、この条件を満たすため承認不要と判定できます。

------

## 4A.12 adaptive retrieval・context budget・memory grounding

retrieval / context selection は固定 topK だけに依存しません。
初期実装では固定値を使ってもよいですが、品質改善では retrieval profile と context budget profile を分けます。

### 型定義: `RetrievalProfile`（検索プロファイル）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `RetrievalProfile` | 検索プロファイル | topK、スコア閾値、適応検索など、検索設定のまとまり。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `profileId` | プロファイルID | 必須 | `string` | プロファイルIDを一意に識別するためのIDです。 |
| `topK` | 取得件数 | 必須 | `number` | 取得件数を数値で管理します。 |
| `minScore` | 最小スコア | 任意 | `number` | 最小スコアを数値で管理します。 |
| `rerankTopK` | 再ランキング件数 | 任意 | `number` | 再ランキング件数を数値で管理します。 |
| `adaptiveEnabled` | 適応制御有効 | 必須 | `boolean` | 適応制御有効を有効にするか、条件を満たすかを示します。 |
| `useScoreDistribution` | スコア分布利用 | 任意 | `boolean` | スコア分布利用を有効にするか、条件を満たすかを示します。 |
| `useDocumentStatistics` | 文書統計利用 | 任意 | `boolean` | 文書統計利用を有効にするか、条件を満たすかを示します。 |
| `useSectionMetadata` | セクションメタデータ利用 | 任意 | `boolean` | セクションメタデータ利用を有効にするか、条件を満たすかを示します。 |
| `useClaimCoverage` | 主張カバレッジ利用 | 任意 | `boolean` | 主張カバレッジ利用を有効にするか、条件を満たすかを示します。 |
| `diversityByDocument` | 文書多様性 | 任意 | `boolean` | 文書多様性を有効にするか、条件を満たすかを示します。 |
| `diversityBySection` | セクション多様性 | 任意 | `boolean` | セクション多様性を有効にするか、条件を満たすかを示します。 |


### 型定義: `ContextBudgetProfile`（文脈予算プロファイル）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ContextBudgetProfile` | 文脈予算プロファイル | LLMに渡すトークン、表、図、メモリカードの上限設定。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `profileId` | プロファイルID | 必須 | `string` | プロファイルIDを一意に識別するためのIDです。 |
| `maxContextTokens` | 最大文脈トークン数 | 必須 | `number` | 最大文脈トークン数を数値で管理します。 |
| `maxChunks` | 最大チャンク | 必須 | `number` | 最大チャンクを数値で管理します。 |
| `maxMemoryCards` | 最大メモリカード数 | 必須 | `number` | 最大メモリカード数を数値で管理します。 |
| `maxTableChunks` | 最大表チャンク数 | 必須 | `number` | 最大表チャンク数を数値で管理します。 |
| `maxFigureDescriptions` | 最大図説明数 | 必須 | `number` | 最大図説明数を数値で管理します。 |
| `compressionStrategy` | 圧縮方式 | 必須 | `"none" / "query_focused" / "structure_aware" / "longllmlingua_like"` | このデータで管理する「圧縮方式」です。 |


段階導入の方針:

```text
1. default 互換:
   既存の固定 threshold / topK を維持する。

2. opt-in:
   adaptive retrieval と structure-aware context memory は設定で有効化する。

3. benchmark:
   answerability、citation、support verification、latency、cost が改善するか測る。

4. rollback:
   regression が出た場合は profile 単位で戻す。
```

memory grounding の受け入れ方針:

```text
- memory hit は final citation ではない。
- memory card から sourceChunkIds / page range を取得し、source chunk を再検索・再認可する。
- source chunk が権限・品質・score gate を通らない場合、その memory は回答根拠にしない。
```

------

## 4A.13 回答生成詳細の受け入れ条件

```text
AC-RAG-ANSWER-001:
回答可否判定は RequiredFact の factId、necessity、factType を持てる。

AC-RAG-ANSWER-002:
primary fact が missing または conflicting の場合、原則として answer_unavailable を返す。

AC-RAG-ANSWER-003:
primary fact が supported で secondary fact の不足だけが残る PARTIAL は、後段の citation validation / answer support verification に進められる。

AC-RAG-ANSWER-004:
sufficient_context_gate は ANSWERABLE / PARTIAL / UNANSWERABLE と factSupports を trace に保存できる。

AC-RAG-ANSWER-005:
回答生成は primary fact について extractive-first answer span を優先できる。

AC-RAG-ANSWER-006:
RagAnswer は optional に usedSpans を返せる。

AC-RAG-ANSWER-007:
question requirement slot を検出し、date、place、organization、section、item、reason、yes_no、amount、unit の要求を回答で満たす。

AC-RAG-ANSWER-008:
回答文ごとに cited evidence または computedFacts に支持されるか verify_answer_support で検証できる。

AC-RAG-ANSWER-009:
不支持文がある場合、supported-only answer repair を行い、修復後に再検証する。

AC-RAG-ANSWER-010:
再検証後も不支持文が残る場合、unsupported answer をそのまま返さない。

AC-RAG-ANSWER-011:
computedFacts は supportingEvidenceIds を持ち、document citation と区別して保存される。

AC-RAG-ANSWER-012:
threshold comparison は comparator、threshold、satisfiesCondition、effect を保持する。

AC-RAG-ANSWER-013:
value mismatch、date mismatch、amount mismatch は riskSignals として保存され、追加検索または conflict judge の routing に使われる。

AC-RAG-ANSWER-014:
TypedClaim conflict は同一 scope の排他的 claim として判定され、scope が異なる場合は即 conflict としない。

AC-RAG-ANSWER-015:
final answer context は minScore filter を通過した chunk のみで構成される。

AC-RAG-ANSWER-016:
simple high-confidence evidence が十分な場合、不要な追加検索を early stop できる。

AC-RAG-ANSWER-017:
assistant の過去発話や compressed summary を document evidence として citation にしない。

AC-RAG-ANSWER-018:
memory hit は source chunk / page range に展開してから回答根拠にする。

AC-RAG-ANSWER-019:
マルチターン follow-up では previous citation anchor を retrieval query に含められる。

AC-RAG-ANSWER-020:
assistant の refusal 文や定型前置きは conversation topic / retrieval query に混ぜない。

AC-RAG-ANSWER-021:
benchmark corpus / runner 経路では benchmark_grounded_short policy を使える。

AC-RAG-ANSWER-022:
benchmark 用 policy は dataset 固有 row id ではなく benchmark metadata で切り替える。

AC-RAG-ANSWER-023:
answer repair、unsupportedSentences、supportingComputedFactIds、contradictionChunkIds は operator_sanitized 以上の debug trace で確認できる。

AC-RAG-ANSWER-024:
利用者向け debug には内部 judge prompt、権限外文書、内部 policy 詳細を表示しない。

AC-RAG-ANSWER-025:
structured fact planning failure 時は legacy fallback を使え、fallback 使用を debug trace に残す。
```

------



## 4A.14 回答生成詳細の実装状態区分

回答生成周辺の仕様は、実装済み・計画・未確定を分けて管理します。
これは、仕様書に将来構想を混ぜ込む場合でも、現在の挙動、導入予定、検討課題を混同しないためです。

| 区分 | 項目 | 仕様上の扱い |
|---|---|---|
| implemented / confirmed | Sufficient Context Gate、PARTIAL 継続条件、RequiredFact の primary / secondary 判断 | 回答可否 contract として採用する |
| implemented / confirmed | Answer Support Verifier、supported-only answer repair | unsupported answer を返さない最終 gate として採用する |
| implemented / confirmed | question requirement slot、answer requirement validation | 回答生成・citation validation の標準検証に含める |
| implemented / confirmed | computedFacts / policyComputation | document citation とは別の system-derived evidence として採用する |
| implemented / confirmed | benchmark_grounded_short | benchmark runner / corpus の評価専用回答 policy として採用する |
| implemented / confirmed | decontextualized query、previous citation anchoring、refusal filtering | マルチターン ChatRAG の標準前処理として採用する |
| implemented / confirmed | memory hit から source chunk / page range への展開 | memory summary を final citation にしない不変条件として採用する |
| implemented / confirmed | final context minScore filter、simple high-confidence early stop | final answer context selection の gate として採用する |
| planned | extractive-first answer span / usedSpans | P1 改善として data contract を先に定義し、導入後に benchmark で有効化する |
| planned | typed claim schema / value mismatch judge 拡張 | riskSignals と conflict routing を先に仕様化し、claim schema は段階導入する |
| planned | structured fact planning の拡張 | legacy fallback を残しつつ RequiredFact の structured fields を増やす |
| planned | adaptive retrieval calibration | default 互換を維持し、opt-in と benchmark gate を通過した profile だけ本番化する |
| planned | structure-aware context memory | memory card 件数・snippet budget・section metadata を profile 化して評価する |
| open_question | threshold の default 値 | false answer、false refusal、latency、cost の benchmark 結果で決める |
| open_question | LLM judge の利用範囲 | 高リスクカテゴリでは人間レビューや deterministic rule との併用を検討する |

受け入れ条件です。

```text
AC-RAG-ANSWER-STATUS-001:
仕様項目は implemented / planned / open_question のいずれかで分類できる。

AC-RAG-ANSWER-STATUS-002:
planned 項目を本番 default にする前に、benchmark profile と rollback 方針を定義する。

AC-RAG-ANSWER-STATUS-003:
open_question の項目は、本番挙動として断定せず、検討課題として trace / roadmap に残す。
```

------

# 4B. チャット内オーケストレーション・ツール実行

## 4B.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Chat orchestration | チャット内オーケストレーション | チャット内で検索、RAG、回答生成、ツール実行、回答不能判定を調整する同期処理。 |
| Tool | ツール | チャット内から呼び出せる検索、文書取得、問い合わせ作成、デバッグ確認などの具体機能。 |
| Tool invocation | ツール実行 | ツールを1回呼び出した記録。入力、出力、承認、監査を持つ。 |
| Human approval | 人間承認 | ツールやエージェントが危険操作を実行する前に人が確認すること。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| ChatOrchestrationMode | チャット内オーケストレーションモード | RAGのみ、ツール併用など実行モードを示す。 |
| ChatOrchestrationRun | チャット内オーケストレーション実行 | チャット内で呼ばれた検索、回答生成、ツール処理を管理する。 |
| ChatToolDefinition | チャット内ツール定義 | toolId、入力、出力、権限、承認要否を管理する。 |
| ChatToolInvocation | チャット内ツール実行 | ツール呼び出しの入力、出力、状態、承認、監査を管理する。 |

### 守るべきルール
- チャット内オーケストレーションはチャット機能の内部処理であり、非同期エージェント実行とは分ける。
- ツール実行は機能権限、リソース権限、必要に応じた人間承認を通す。
- 外部送信、書き込み、公開、削除、担当者起票などは危険操作として扱う。
- ツールが読める情報は実行ユーザーが読める情報を超えてはならない。

### 実行すべき処理
1. ユーザー質問を解釈し、RAG、文書取得、図面解析、問い合わせ作成など必要なツールを選ぶ。
2. ツールごとの権限と入力妥当性を確認する。
3. 必要な場合は人間承認を挟み、承認後にツールを実行する。
4. ツール実行結果を回答生成またはUI表示に渡し、監査ログへ記録する。

### UI
- チャット画面にツール実行中、承認待ち、成功、失敗を表示する。
- 承認が必要な場合は、操作名、対象、入力、影響、理由入力を表示する。
- 利用者には内部ツールIDではなく、分かりやすい操作名で表示する。

------

## 4B.1 定義変更

これまで「エージェント機能」と呼んでいた、チャット内部で RAG、回答生成、問い合わせ作成、検索改善候補作成、デバッグ要約などを複数ステップで行う機能は、この仕様では **チャット内オーケストレーション** と呼びます。

```text
旧名称:
エージェント機能 / AgentRun

新名称:
チャット内オーケストレーション / ChatOrchestrationRun
```

理由:

```text
- チャット回答の一部として同期的に動く
- RAG検索、回答生成、ツール実行を同じ会話UI内で扱う
- 非同期で Claude Code / Codex / OpenCode などを起動する新しいエージェント機能と区別する
```

------

## 4B.2 チャット内オーケストレーションの目的

```text
チャット内オーケストレーション =
  会話状態の読み込み
  + 必要な履歴圧縮
  + RAG検索
  + ツール選択
  + ツール実行
  + 回答生成
  + 回答不能判定
  + 担当者対応導線
```

チャット内オーケストレーションは、ユーザーの権限を超えて操作してはいけません。

```text
チャット内オーケストレーションができること <= 実行ユーザーができること
```

LLM の内部推論は UI に出しません。
ユーザーと運用者には、実行した手順、使ったツール、入力概要、出力概要、失敗理由を構造化して表示します。

------

## 4B.3 ChatOrchestrationRun

### 型定義: `ChatOrchestrationMode`（チャット内オーケストレーションモード）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ChatOrchestrationMode` | チャット内オーケストレーションモード | チャット内でRAG回答、問い合わせ振り分け、デバッグなど何を行うかのモード。 |

| 英名（値） | 日本語名 | 内容 |
|---|---|---|
| `rag_answer` | RAG回答 | チャット内でRAG回答を行うモード。 |
| `support_triage` | 問い合わせ振り分け | 問い合わせ対応へ振り分けるモード。 |
| `knowledge_admin_assist` | ナレッジ管理支援 | 文書・品質管理を支援するモード。 |
| `search_improvement_assist` | 検索改善支援 | 検索改善候補を扱うモード。 |
| `benchmark_assist` | ベンチマーク支援 | 評価・ベンチマークを支援するモード。 |
| `debug_assist` | デバッグ支援 | トレース確認や診断を支援するモード。 |


### 型定義: `ChatOrchestrationRun`（チャット内オーケストレーション実行）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ChatOrchestrationRun` | チャット内オーケストレーション実行 | チャット内で検索、圧縮、ツール実行、回答生成を調整する実行単位。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `orchestrationRunId` | オーケストレーション実行ID | 必須 | `string` | オーケストレーション実行IDを一意に識別するためのIDです。 |
| `tenantId` | テナントID | 必須 | `string` | テナントIDを一意に識別するためのIDです。 |
| `sessionId` | セッションID | 必須 | `string` | セッションIDを一意に識別するためのIDです。 |
| `messageId` | メッセージID | 必須 | `string` | メッセージIDを一意に識別するためのIDです。 |
| `requesterUserId` | 依頼者ユーザーID | 必須 | `string` | 依頼者ユーザーIDを一意に識別するためのIDです。 |
| `mode` | モード | 必須 | `ChatOrchestrationMode` | このデータで管理する「モード」です。 |
| `status` | 状態 | 必須 | `"queued" / "loading_context" / "compressing_context" / "planning" / "searching" / "running_tool" / "generating" / "answer_unavailable" / "completed" / "failed" / "cancelled"` | 対象の現在の状態を示します。 |
| `modelId` | モデルID | 必須 | `string` | モデルIDを一意に識別するためのIDです。 |
| `promptVersion` | プロンプトバージョン | 必須 | `string` | 利用したプロンプトバージョンを記録し、再実行や差分確認に使います。 |
| `contextCompressionVersion` | 文脈圧縮バージョン | 任意 | `string` | 利用した文脈圧縮バージョンを記録し、再実行や差分確認に使います。 |
| `maxToolCalls` | 最大ツール呼び出し数 | 必須 | `number` | 最大ツール呼び出し数を数値で管理します。 |
| `toolCallCount` | ツール呼び出し数 | 必須 | `number` | ツール呼び出し数を数値で管理します。 |
| `ragRunIds` | RAG実行ID一覧 | 必須 | `string[]` | 複数のRAG実行を識別するIDの一覧です。 |
| `toolInvocationIds` | ツール実行ID一覧 | 必須 | `string[]` | 複数のツール実行を識別するIDの一覧です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |
| `completedAt` | 完了日時 | 任意 | `string` | 完了日時を記録します。 |


MVP では、次を優先します。

```text
rag_answer:
RAG検索と回答生成を行う。

support_triage:
回答不能、低評価、手動依頼から問い合わせを作成・分類する。

search_improvement_assist:
検索失敗や低評価から検索語対応づけ候補を作る。

debug_assist:
取り込み、検索、回答不能、ツール実行の trace を安全に要約する。
```

------

## 4B.4 ツール定義

### 型定義: `ChatToolDefinition`（チャット内ツール定義）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ChatToolDefinition` | チャット内ツール定義 | チャット内から呼び出せる検索、文書取得、問い合わせ作成などのツール仕様。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `toolId` | ツールID | 必須 | `string` | ツールIDを一意に識別するためのIDです。 |
| `name` | 名称 | 必須 | `string` | このデータで管理する「名称」です。 |
| `displayName` | 表示名 | 必須 | `string` | このデータで管理する「表示名」です。 |
| `description` | 説明 | 必須 | `string` | このデータで管理する「説明」です。 |
| `category` | 分類 | 必須 | `"rag" / "ingest" / "document" / "drawing" / "support" / "search_improvement" / "benchmark" / "debug" / "admin" / "external"` | このデータで管理する「分類」です。 |
| `inputSchema` | 入力スキーマ | 必須 | `unknown` | このデータで管理する「入力スキーマ」です。 |
| `outputSchema` | 出力スキーマ | 必須 | `unknown` | このデータで管理する「出力スキーマ」です。 |
| `requiredFeaturePermission` | 必要機能権限 | 必須 | `string` | 必要機能権限を有効にするか、条件を満たすかを示します。 |
| `requiredResourcePermission` | 必要リソース権限 | 任意 | `"readOnly" / "full"` | 必要リソース権限を有効にするか、条件を満たすかを示します。 |
| `approvalRequired` | 承認要否 | 必須 | `boolean` | 承認要否を有効にするか、条件を満たすかを示します。 |
| `auditRequired` | 監査要否 | 必須 | `boolean` | 監査要否を有効にするか、条件を満たすかを示します。 |
| `enabled` | 有効 | 必須 | `boolean` | 有効を有効にするか、条件を満たすかを示します。 |


ツールは、チャット内で利用する内部機能です。
非同期エージェント実行器とは別に管理します。

------

## 4B.5 具体ツール一覧

### 4B.5.1 RAG / 検索ツール

| toolId | 目的 | 主な input | 主な output | 権限 | 承認 |
|---|---|---|---|---|---|
| `rag.search` | 権限内文書を lexical / vector で検索する | query, searchScope, topK | authorized evidence candidates | `chat:create` または `rag:run` + 対象 readOnly | 不要 |
| `rag.rerank` | 検索候補を再順位付けする | query, evidence candidates | reranked evidence | `rag:run` | 不要 |
| `rag.answer` | authorized evidence から回答を生成する | question, evidence, promptVersion | answer, citations | `chat:create` または `rag:run` | 不要 |
| `rag.explain_unavailable` | 回答不能理由を利用者向けに整形する | reason, sanitizedDiagnostics | userVisibleMessage, nextActions | `chat:create` または `rag:run` | 不要 |
| `rag.search_test` | 管理者が検索結果を検証する | query, scope, retrieverVersion | result diff, scores | `rag:trace:read:sanitized` + 対象 readOnly | 不要 |
| `rag.decontextualize_query` | マルチターンの省略質問を standalone question に変換する | messages, previousCitations | standaloneQuestion, retrievalQueries, turnDependency | `chat:create` または `rag:run` | 不要 |
| `rag.plan_required_facts` | 質問に必要な RequiredFact を構造化する | question, searchScope | RequiredFact[] | `chat:create` または `rag:run` | 不要 |
| `rag.evaluate_answerability` | RequiredFact と evidence coverage から回答可否を判定する | requiredFacts, evidence | SufficientContextJudgement | `chat:create` または `rag:run` | 不要 |
| `rag.select_final_context` | minScore、diversity、品質条件で回答 context を確定する | rerankedEvidence, runtimePolicy | finalEvidence, droppedReason | `rag:run` | 不要 |
| `rag.compute_policy_facts` | 日付・金額・閾値条件を computedFacts に変換する | question, evidence, policyRules | ComputedFact[], PolicyComputation[] | `chat:create` または `rag:run` | 不要 |
| `rag.validate_citations` | citation と質問要求 slot の充足を検証する | answer, citations, requirementSlots | validationResult | `rag:run` | 不要 |
| `rag.verify_answer_support` | 回答文ごとの根拠支持を検証する | answer, evidence, computedFacts | AnswerSupportJudgement | `rag:run` | 不要 |
| `rag.repair_supported_only` | 不支持文を除き、支持された事実だけで回答を修復する | answer, unsupportedSentences, evidence | repairedAnswer | `rag:run` | 不要 |
| `rag.detect_claim_conflict` | typed claim / value mismatch から矛盾候補を判定する | claims, riskSignals | ClaimConflictJudgement | `rag:run` | 不要 |

### 4B.5.2 文書 / 取り込みツール

| toolId | 目的 | 主な input | 主な output | 権限 | 承認 |
|---|---|---|---|---|---|
| `document.get_metadata` | 文書 metadata を取得する | documentId | metadata | `document:read` + 所属フォルダ readOnly | 不要 |
| `document.get_chunks` | chunk preview を取得する | documentId, filters | chunk summaries | `debug:chunk:read` + 所属フォルダ readOnly | 不要 |
| `document.get_citations` | citation 表示情報を取得する | chunkIds | citation data | `document:read` + 所属フォルダ readOnly | 不要 |
| `document.reindex_request` | 再インデックスを要求する | targetType, targetId, reason | reindexRunId | `index:rebuild` + 対象 full | 必要 |
| `ingest.get_status` | 取り込み run の状態を取得する | ingestRunId | status, counters, warnings | `debug:ingest:read` + 対象 readOnly | 不要 |
| `ingest.retry_failed` | 失敗した取り込みを再実行する | ingestRunId, reason | newIngestRunId | `index:rebuild` + 対象 full | 必要 |
| `ingest.preview_extraction` | 抽出結果の preview を確認する | ingestRunId | extracted text summary | `debug:ingest:read` + 対象 readOnly | 不要 |

### 4B.5.3 図面系ツール

| toolId | 目的 | 主な input | 主な output | 権限 | 承認 |
|---|---|---|---|---|---|
| `drawing.extract_title_block` | 図面番号、図面名、改訂、尺度などを抽出する | documentId, page/layout | titleBlock fields | `document:read` + 対象 readOnly | 不要 |
| `drawing.list_layers` | CAD layer 一覧を取得する | documentId, layoutName | layerNames, visibility | `document:read` + 対象 readOnly | 不要 |
| `drawing.list_blocks` | block / symbol 一覧を取得する | documentId | blockNames, counts | `document:read` + 対象 readOnly | 不要 |
| `drawing.render_sheet` | 図面 sheet を表示用画像へ変換する | documentId, page/layout | imageRef, bboxMap | `document:read` + 対象 readOnly | 不要 |
| `drawing.find_annotations` | 注記・寸法文字・表を抽出する | documentId, page/layout | annotation chunks | `document:read` + 対象 readOnly | 不要 |
| `drawing.get_bim_entities` | IFC entity / property set を取得する | documentId, filters | entity summaries | `document:read` + 対象 readOnly | 不要 |

図面系ツールは参照専用です。
図面ファイルの編集、CAD への書き戻し、外部ストレージへの出力は MVP の対象外にします。

### 4B.5.4 問い合わせ対応ツール

| toolId | 目的 | 主な input | 主な output | 権限 | 承認 |
|---|---|---|---|---|---|
| `support.ticket.create` | 回答不能や低評価から問い合わせを作成する | sessionId, messageId, reason, userComment | ticketId | `support:ticket:create:self` または `support:ticket:update` | 利用者の明示操作が必要 |
| `support.ticket.update` | 問い合わせの状態、担当者、メモを更新する | ticketId, patch | updated ticket | `support:ticket:update` + 割当 ticket | 不要 |
| `support.ticket.assign` | 問い合わせを担当者へ割り当てる | ticketId, assignee | assignment | `support:ticket:assign` | 不要 |
| `support.draft_answer.create` | 担当者向け回答案を作成する | ticketId, evidence | draftAnswer | `support:draft_answer:create` | 不要 |
| `support.draft_answer.send` | 回答案を利用者へ送信する | ticketId, draftAnswerId | sent message | `support:draft_answer:send` | 必要 |

### 4B.5.5 検索改善 / ベンチマークツール

| toolId | 目的 | 主な input | 主な output | 権限 | 承認 |
|---|---|---|---|---|---|
| `search_improvement.suggest` | 検索語対応づけ候補を作る | failedQuery, evidence, ticketId | candidate mappings | `search_improvement:suggest` | 不要 |
| `search_improvement.test` | 反映前後の検索結果差分を確認する | mappingId, testQueries | before/after diff | `search_improvement:review` | 不要 |
| `search_improvement.publish` | 検索改善ルールを公開する | mappingId, reason | published version | `search_improvement:publish` | 必要 |
| `benchmark.run` | benchmark run を開始する | suiteId, scope, targetConfig | benchmarkRunId | `benchmark:run` + 対象 readOnly | 不要 |
| `benchmark.compare` | 前回 run と比較する | runId, baselineRunId | metric diff | `benchmark:read` | 不要 |
| `benchmark.promote_result` | benchmark 結果を本番反映する | runId, reason | promotion result | `benchmark:promote_result` | 必要 |

### 4B.5.6 デバッグツール

| toolId | 目的 | 主な input | 主な output | 権限 | 承認 |
|---|---|---|---|---|---|
| `debug.trace.get` | sanitize 済み trace を取得する | targetType, targetId | DebugTrace | `debug:trace:read:sanitized` | 不要 |
| `debug.trace.export` | trace を JSON で export する | traceId | export artifact | `debug:trace:export` | 必要 |
| `debug.rag_run.inspect` | RAG run の検索・rerank・回答不能理由を確認する | ragRunId | sanitized run detail | `rag:trace:read:sanitized` | 不要 |
| `debug.ingest_run.inspect` | 取り込み run の拡張子別処理と chunk 結果を確認する | ingestRunId | extraction/chunk summary | `debug:ingest:read` | 不要 |
| `debug.tool_invocation.inspect` | tool 入出力概要とエラーを確認する | invocationId | sanitized invocation | `chat_orchestration:trace:read:sanitized` | 不要 |

### 4B.5.7 外部連携ツール

| toolId | 目的 | 主な input | 主な output | 権限 | 承認 |
|---|---|---|---|---|---|
| `external.ticket.create` | 外部チケットシステムへ問い合わせを連携する | ticket summary | external ticket id | `tool:credential:use` + `support:ticket:update` | 必要 |
| `external.workflow.start` | 社内ワークフローを開始する | workflowId, payload | workflowRunId | `tool:credential:use` | 必要 |
| `external.webhook.post` | 設定済み webhook に通知する | webhookId, payload | delivery result | `tool:credential:use` | 必要 |

外部連携ツールへ送る payload は、権限外文書情報、内部 policy、不要な会話本文を含めません。

------


### 4B.5.8 ナレッジ品質 / 高度文書解析ツール

| toolId | 用途 | input | output | 必要権限 | 承認 |
|---|---|---|---|---|---|
| `quality.document.get_profile` | 文書の品質プロファイルを取得する | documentId | DocumentQualityProfile | `quality:read` + 対象 readOnly | 不要 |
| `quality.document.update_status` | 検証状態、鮮度状態、RAG利用可否を更新する | documentId, status changes, reason | updated profile | `quality:update` + 対象 full | 必要 |
| `quality.document.request_review` | 文書オーナーへ検証依頼を作成する | documentId, reason | review request | `quality:review_request:create` + 対象 readOnly | 不要 |
| `quality.document.exclude_from_rag` | 文書をRAG対象から除外する | documentId, reason | updated profile | `quality:exclude` + 対象 full | 必要 |
| `quality.conflict.detect` | 新旧・矛盾候補を検出する | folderId/documentIds | conflict candidates | `quality:conflict:detect` + 対象 readOnly | 不要 |
| `parse.document.get_result` | ParsedDocument を取得する | documentId | parsed pages / blocks summary | `parse:read` + 対象 readOnly | 不要 |
| `parse.document.reanalyze` | 文書を再解析する | documentId, parserConfig | ingest/reparse run | `parse:reanalyze` + 対象 full | 必要 |
| `parse.table.review` | 表抽出結果をレビューする | tableId, correction | corrected table | `parse:table:review` + 対象 full | 必要 |
| `parse.ocr.rerun` | OCRを再実行する | documentId/pageRange, ocrConfig | reparse run | `parse:ocr:rerun` + 対象 full | 必要 |
| `parse.figure.review` | 図説明・図OCRをレビューする | figureId, correction | corrected figure | `parse:figure:review` + 対象 full | 必要 |

## 4B.6 ChatToolInvocation

### 型定義: `ChatToolInvocation`（チャット内ツール実行）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ChatToolInvocation` | チャット内ツール実行 | 実際にツールを呼び出した1回分の入力、出力、承認、監査情報。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `invocationId` | 実行ID | 必須 | `string` | 実行IDを一意に識別するためのIDです。 |
| `orchestrationRunId` | オーケストレーション実行ID | 必須 | `string` | オーケストレーション実行IDを一意に識別するためのIDです。 |
| `toolId` | ツールID | 必須 | `string` | ツールIDを一意に識別するためのIDです。 |
| `requesterUserId` | 依頼者ユーザーID | 必須 | `string` | 依頼者ユーザーIDを一意に識別するためのIDです。 |
| `status` | 状態 | 必須 | `"queued" / "waiting_for_approval" / "running" / "succeeded" / "failed" / "cancelled"` | 対象の現在の状態を示します。 |
| `input` | 入力 | 必須 | `unknown` | このデータで管理する「入力」です。 |
| `inputSummary` | 入力要約 | 任意 | `unknown` | このデータで管理する「入力要約」です。 |
| `output` | 出力 | 任意 | `unknown` | このデータで管理する「出力」です。 |
| `outputSummary` | 出力要約 | 任意 | `unknown` | このデータで管理する「出力要約」です。 |
| `errorCode` | エラーコード | 任意 | `string` | このデータで管理する「エラーコード」です。 |
| `errorMessage` | エラーメッセージ | 任意 | `string` | エラーメッセージとして表示または処理する文字列です。 |
| `approvedBy` | 承認者 | 任意 | `string` | 承認者を示します。 |
| `approvedAt` | 承認日時 | 任意 | `string` | 承認日時を記録します。 |
| `startedAt` | 開始日時 | 任意 | `string` | 開始日時を記録します。 |
| `completedAt` | 完了日時 | 任意 | `string` | 完了日時を記録します。 |


ツール出力は信頼しません。
LLM に渡す前に schema validation、サイズ制限、機密情報除去を行います。

------

## 4B.7 ツール実行の認可

チャット内ツール実行は、必ず次を確認します。

```text
1. ユーザー active
2. chat:create または対象機能の feature permission
3. chat_tool:execute
4. ChatToolDefinition.requiredFeaturePermission
5. 対象 resource permission
6. approvalRequired の場合は承認
7. 外部送信の場合は payload の sanitize
```

例:

```text
support.ticket.create:
- chat:feedback:create または support:ticket:create:self
- 対象 session が本人のもの、または問い合わせ化可能なもの

search_improvement.suggest:
- search_improvement:suggest
- 対象 scope の閲覧権限

benchmark.run:
- benchmark:run
- 対象フォルダ readOnly 以上

drawing.list_layers:
- document:read
- 対象文書の所属フォルダ readOnly 以上
```

------

## 4B.8 人間承認が必要なチャット内ツール

次のツール実行は、原則として人間承認または明示操作を必須にします。

```text
- フォルダ削除
- 文書削除
- 共有設定変更
- 再インデックス
- cutover
- rollback
- 品質ステータス変更
- 検証状態変更
- 鮮度状態変更
- RAG対象除外 / 復帰
- 再解析
- OCR再実行
- 表抽出レビュー
- 図解析レビュー
- 検索改善の公開
- benchmark 結果の本番反映
- 担当者から利用者への回答送信
- ロール付与 / 剥奪
- 外部システムへの送信
```

チャット内オーケストレーションが危険操作を自動実行してはいけません。

------

## 4B.9 チャット内ツール実行 UI

チャット内では、必要に応じてツール実行状況を表示します。

```text
資料を検索しています...
検索結果を確認しています...
図面のタイトルブロックを確認しています...
問い合わせを作成しています...
担当者に確認するための内容をまとめています...
```

危険操作または外部送信では、実行前に確認画面を出します。

```text
この内容で担当者に確認します。
送信される内容:
- 質問
- AI回答または回答不能理由
- 現在の回答範囲
- 利用者コメント

[送信する]
[キャンセル]
```

------

## 4B.10 チャット内オーケストレーションの受け入れ条件

```text
AC-CHAT-ORCH-001:
ChatOrchestrationRun は実行ユーザーの権限を超えた操作を実行できない。

AC-CHAT-ORCH-002:
ChatToolInvocation は feature permission と resource permission を確認してから実行する。

AC-CHAT-ORCH-003:
ツール出力は schema validation 後に LLM へ渡す。

AC-CHAT-ORCH-004:
危険操作ツールは自動実行せず、承認または明示操作を必須にする。

AC-CHAT-ORCH-005:
ChatToolInvocation の入出力、実行者、時刻、結果は監査可能にする。

AC-CHAT-ORCH-006:
外部ツールに送るデータは最小化し、権限外文書情報を含めない。

AC-CHAT-ORCH-007:
maxToolCalls、timeout、二重実行防止を設定する。

AC-CHAT-ORCH-008:
失敗したツール実行は、利用者に安全なメッセージを返す。

AC-CHAT-ORCH-009:
担当者確認ツールは、送信前に利用者が内容を確認できる。

AC-CHAT-ORCH-010:
チャット内オーケストレーションの思考過程ではなく、実行した手順と結果をユーザー向けに表示する。
```

------

# 4C. 非同期エージェント実行

## 4C.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Async agent | 非同期エージェント | Claude Code、Codex、OpenCodeなどを使い、長時間・複数ファイル作業を実行する機能。 |
| Runtime provider | 実行器 | Claude Code、Codex、OpenCode、customなど、非同期エージェントを動かす仕組み。 |
| Workspace mount | ワークスペースマウント | 共有フォルダ内の元ファイルをエージェント実行環境で読めるようにすること。 |
| Skill | スキル | エージェントに与える手順、専門知識、作業方法をMarkdownで定義したもの。 |
| Agent profile | エージェントプロファイル | エージェントの役割、推奨モデル、既定スキルをMarkdownで定義したもの。 |
| Agent preset | エージェントプリセット | よく使う実行器、モデル、スキル、対象ファイルの組み合わせ。 |
| Agent artifact | エージェント成果物 | エージェントが生成したファイル、差分、レポート。 |
| Writeback | 書き戻し | エージェント成果物をフォルダへ保存または既存ファイルへ反映すること。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| AgentRuntimeProvider | エージェント実行器 | Claude Code、Codex、OpenCode、customなどの実行器を表す。 |
| AgentModelSelection | エージェントモデル選択 | providerごとのモデル、既定値、実行時選択を管理する。 |
| AsyncAgentRun | 非同期エージェント実行 | 依頼、対象ファイル、実行器、モデル、状態、成果物を管理する。 |
| AgentWorkspaceMount | ワークスペースマウント | 共有フォルダ内の元ファイルを実行環境に渡す設定を管理する。 |
| SkillDefinition | スキル定義 | Markdownで作成されたskillの内容、共有、バージョンを管理する。 |
| AgentProfileDefinition | エージェントプロファイル定義 | Markdownで作成されたagent profileの内容、共有、バージョンを管理する。 |
| AgentExecutionPreset | エージェント実行プリセット | よく使う実行設定をお気に入りとして管理する。 |
| AgentArtifact | エージェント成果物 | 生成ファイル、差分、レポート、保存先候補を管理する。 |

### 守るべきルール
- 非同期エージェントはチャット内RAGとは別のrunとして扱う。
- 共有フォルダ内のファイルはchunkではなく元ファイルとしてworkspaceにmountする。
- mountできるファイルは、実行ユーザーがreadOnly以上を持つ対象に限定する。
- writebackには保存先full権限、writeback権限、明示承認が必要。
- skillsとagent profileはフォルダ同様に階層共有できるが、実行時には選択分をフラット化する。
- 実行器とモデルは実行時に選べ、個人設定で既定値を持てる。

### 実行すべき処理
1. 実行器、モデル、対象ファイル、skill、agent profile、プリセットを選択する。
2. 権限を確認してworkspace mountを作成する。
3. 非同期runを作成し、進捗、ログ、成果物を保存する。
4. 成果物の確認後、必要に応じてwriteback承認を行う。
5. skillsやagent profileは作成画面またはチャット形式のAI補助で生成する。

### UI
- 非同期エージェント実行画面でprovider、model、対象ファイル、skill、agent profileを選択する。
- よく使う組み合わせを複数のお気に入りプリセットとして保存できる。
- run詳細で進捗、ログ、成果物、writeback承認状態を確認できる。
- skills/agent profileの共有画面はフォルダ共有と同じ考え方で表示する。

------

## 4C.1 目的

非同期エージェント実行は、Claude Code / Codex / OpenCode などのエージェント実行器を使って、長時間・複数ファイル・成果物生成を伴う作業を非同期に実行する機能です。

```text
非同期エージェント実行 =
  実行器選択
  + モデル選択
  + 対象フォルダ / ファイルの raw mount
  + skills / agent profile の選択
  + sandbox 実行
  + 成果物保存
  + 必要に応じた適用 / 共有
```

チャット回答とは異なり、結果は run として保存し、実行中・完了・失敗・キャンセルを追跡します。

------

## 4C.2 実行器とモデル

### 型定義: `AgentRuntimeProvider`（エージェント実行器）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `AgentRuntimeProvider` | エージェント実行器 | Claude Code、Codex、OpenCodeなど、非同期エージェントを動かす提供元。 |

| 英名（値） | 日本語名 | 内容 |
|---|---|---|
| `claude_code` | Claude Code | Claude Codeを実行器として使う。 |
| `codex` | Codex | Codexを実行器として使う。 |
| `opencode` | OpenCode | OpenCodeを実行器として使う。 |
| `custom` | カスタム | 組織独自の種別。 |


### 型定義: `AgentModelSelection`（エージェントモデル選択）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `AgentModelSelection` | エージェントモデル選択 | 非同期エージェントで使う実行器、モデル、表示名を表す。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `provider` | 提供元 | 必須 | `AgentRuntimeProvider` | このデータで管理する「提供元」です。 |
| `modelId` | モデルID | 必須 | `string` | モデルIDを一意に識別するためのIDです。 |
| `modelDisplayName` | モデル表示名 | 任意 | `string` | このデータで管理する「モデル表示名」です。 |
| `maxTokens` | 最大トークン数 | 任意 | `number` | 最大トークン数を数値で管理します。 |
| `temperature` | temperature | 任意 | `number` | temperatureを数値で管理します。 |


実行時に次を選択できます。

```text
- 実行器: Claude Code / Codex / OpenCode / custom
- モデル: 実行器が提供するモデル
- 対象フォルダ / ファイル
- 使用する skill
- 使用する agent profile
- 実行指示
- 出力先
- 予算、timeout、最大ステップ数
```

個人設定で既定値を持てます。
ただし、実行時に選択した値が個人設定より優先されます。

```text
優先順位:
1. 実行時指定
2. お気に入りプリセット
3. 個人設定
4. テナント / 管理者デフォルト
```

------

## 4C.3 AsyncAgentRun

### 型定義: `AsyncAgentRun`（非同期エージェント実行）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `AsyncAgentRun` | 非同期エージェント実行 | 長時間・複数ファイル作業を非同期で行うエージェント実行単位。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `agentRunId` | エージェント実行ID | 必須 | `string` | エージェント実行IDを一意に識別するためのIDです。 |
| `tenantId` | テナントID | 必須 | `string` | テナントIDを一意に識別するためのIDです。 |
| `requesterUserId` | 依頼者ユーザーID | 必須 | `string` | 依頼者ユーザーIDを一意に識別するためのIDです。 |
| `provider` | 提供元 | 必須 | `AgentRuntimeProvider` | このデータで管理する「提供元」です。 |
| `modelId` | モデルID | 必須 | `string` | モデルIDを一意に識別するためのIDです。 |
| `status` | 状態 | 必須 | `"queued" / "preparing_workspace" / "running" / "waiting_for_approval" / "completed" / "failed" / "cancelled" / "expired"` | 対象の現在の状態を示します。 |
| `instruction` | instruction | 必須 | `string` | このデータで管理する「instruction」です。 |
| `selectedFolderIds` | 選択フォルダID一覧 | 必須 | `string[]` | 複数の選択フォルダを識別するIDの一覧です。 |
| `selectedDocumentIds` | 選択文書ID一覧 | 必須 | `string[]` | 複数の選択文書を識別するIDの一覧です。 |
| `selectedSkillIds` | 選択スキルID一覧 | 必須 | `string[]` | 複数の選択スキルを識別するIDの一覧です。 |
| `selectedAgentProfileIds` | 選択エージェントプロファイルID一覧 | 必須 | `string[]` | 複数の選択エージェントプロファイルを識別するIDの一覧です。 |
| `workspaceId` | ワークスペースID | 必須 | `string` | ワークスペースIDを一意に識別するためのIDです。 |
| `artifactIds` | 成果物ID一覧 | 必須 | `string[]` | 複数の成果物を識別するIDの一覧です。 |
| `budget` | 予算 | 任意 | `object（主な項目: maxCost, maxDurationMinutes, maxToolCalls）` | このデータで管理する「予算」です。 |
| `createdBy` | 作成者ID | 必須 | `string` | 作成者IDを示します。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `startedAt` | 開始日時 | 任意 | `string` | 開始日時を記録します。 |
| `completedAt` | 完了日時 | 任意 | `string` | 完了日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


`AsyncAgentRun` は、チャット履歴とは別の run として一覧化します。
チャットから起動した場合は、元の `sessionId` / `messageId` を optional で紐づけます。

------

## 4C.4 共有フォルダ内ファイルの扱い

非同期エージェントでは、RAG 用 chunk ではなく、共有フォルダ内の元ファイルをそのまま workspace に mount します。

```text
チャット内RAG:
chunk / metadata / vector index を検索し、authorized evidence を LLM に渡す。

非同期エージェント:
選択されたフォルダ / ファイルの original file を workspace に配置または mount し、実行器が raw file として読む。
```

### 型定義: `AgentWorkspaceMount`（エージェントワークスペースマウント）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `AgentWorkspaceMount` | エージェントワークスペースマウント | エージェント実行時に共有フォルダや文書を元ファイルとして使えるようにする設定。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `mountId` | マウントID | 必須 | `string` | マウントIDを一意に識別するためのIDです。 |
| `workspaceId` | ワークスペースID | 必須 | `string` | ワークスペースIDを一意に識別するためのIDです。 |
| `sourceType` | 元種別 | 必須 | `"folder" / "document" / "temporaryUpload" / "artifact"` | このデータで管理する「元種別」です。 |
| `sourceId` | 元ID | 必須 | `string` | 元IDを一意に識別するためのIDです。 |
| `originalFileName` | 元ファイル名 | 任意 | `string` | このデータで管理する「元ファイル名」です。 |
| `mountedPath` | マウント先パス | 必須 | `string` | このデータで管理する「マウント先パス」です。 |
| `accessMode` | アクセスモード | 必須 | `"readOnly" / "writableCopy"` | このデータで管理する「アクセスモード」です。 |
| `permissionCheckedAt` | 権限確認日時 | 必須 | `string` | 権限確認日時を記録します。 |


権限ルール:

```text
readOnly mount:
対象フォルダ / 文書に readOnly 以上が必要。
元ファイルをそのまま読み込めるが、元ファイルへ書き戻せない。

writableCopy:
対象フォルダに full が必要。
実行器は workspace 内のコピーを編集できる。
元フォルダへの反映は、利用者の明示承認後に行う。

writeback:
元フォルダへ成果物を保存または既存ファイルを更新する場合、対象フォルダ full と危険操作承認が必要。
```

セキュリティ制約:

```text
- mount 前に resource permission を確認する
- run 中に権限が失われた場合は追加読み込みを停止する
- workspace は tenant / user / run 単位で分離する
- run 完了後は retention policy に従い削除または archive する
- workspace path に権限外ファイルを混ぜない
```

------

## 4C.5 skills / agent profile の Markdown 管理

非同期エージェントでは、Markdown で共有される `skill` と `agent profile` を設定できます。

```text
skill:
特定作業の手順、制約、チェックリスト、出力形式を定義する Markdown。
例: 図面レビュー skill、仕様書要約 skill、設計QA検証 skill。

agent profile:
エージェントの役割、振る舞い、利用可能 skill、出力方針を定義する Markdown。
例: 設計レビュー担当 agent、社内規程QA agent、ベンチマーク作成 agent。
```

### 型定義: `SkillDefinition`（スキル定義）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `SkillDefinition` | スキル定義 | エージェントに与える作業手順や専門知識をMarkdownとして管理する定義。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `skillId` | スキルID | 必須 | `string` | スキルIDを一意に識別するためのIDです。 |
| `tenantId` | テナントID | 必須 | `string` | テナントIDを一意に識別するためのIDです。 |
| `name` | 名称 | 必須 | `string` | このデータで管理する「名称」です。 |
| `description` | 説明 | 任意 | `string` | このデータで管理する「説明」です。 |
| `folderId` | フォルダID | 必須 | `string` | フォルダIDを一意に識別するためのIDです。 |
| `markdownDocumentId` | Markdown文書ID | 必須 | `string` | Markdown文書IDを一意に識別するためのIDです。 |
| `version` | バージョン | 必須 | `string` | 利用したバージョンを記録し、再実行や差分確認に使います。 |
| `status` | 状態 | 必須 | `"draft" / "active" / "archived"` | 対象の現在の状態を示します。 |
| `createdBy` | 作成者ID | 必須 | `string` | 作成者IDを示します。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


### 型定義: `AgentProfileDefinition`（エージェントプロファイル定義）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `AgentProfileDefinition` | エージェントプロファイル定義 | エージェントの役割、推奨モデル、既定スキルをMarkdownで管理する定義。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `agentProfileId` | エージェントプロファイルID | 必須 | `string` | エージェントプロファイルIDを一意に識別するためのIDです。 |
| `tenantId` | テナントID | 必須 | `string` | テナントIDを一意に識別するためのIDです。 |
| `name` | 名称 | 必須 | `string` | このデータで管理する「名称」です。 |
| `description` | 説明 | 任意 | `string` | このデータで管理する「説明」です。 |
| `folderId` | フォルダID | 必須 | `string` | フォルダIDを一意に識別するためのIDです。 |
| `markdownDocumentId` | Markdown文書ID | 必須 | `string` | Markdown文書IDを一意に識別するためのIDです。 |
| `defaultSkillIds` | 既定スキルID一覧 | 必須 | `string[]` | 複数の既定スキルを識別するIDの一覧です。 |
| `recommendedProvider` | 推奨実行器 | 任意 | `AgentRuntimeProvider` | このデータで管理する「推奨実行器」です。 |
| `recommendedModelId` | 推奨モデルID | 任意 | `string` | 推奨モデルIDを一意に識別するためのIDです。 |
| `version` | バージョン | 必須 | `string` | 利用したバージョンを記録し、再実行や差分確認に使います。 |
| `status` | 状態 | 必須 | `"draft" / "active" / "archived"` | 対象の現在の状態を示します。 |
| `createdBy` | 作成者ID | 必須 | `string` | 作成者IDを示します。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


作成方法:

```text
1. 作成画面で手動作成する。
2. 既存 Markdown をアップロードして skill / agent profile として登録する。
3. チャット形式で AI に作成させ、利用者が確認して保存する。
4. 既存 skill / agent profile を複製して編集する。
```

AI 作成時の原則:

```text
- AI が生成した Markdown は draft として保存する
- 公開 / 共有前に利用者または管理者が確認する
- 危険な外部送信、権限昇格、秘密情報要求を含む指示は検出・警告する
- 生成元の会話や使用資料は、権限内のものだけを参照する
```

------

## 4C.6 skills / agent profile の共有

skills / agent profile は、フォルダと同じ考え方で階層共有できます。

```text
SkillFolder / AgentProfileFolder =
  Markdown定義の置き場所
  + 共有設定の単位
  + 管理権限の単位
```

共有ルール:

```text
- 管理者は個人またはグループ
- パスは管理者ごとに一意
- 親フォルダの共有を継承する
- 子フォルダに個別設定がある場合は子の設定を優先する
- readOnly は利用・参照可能
- full は作成・編集・削除・共有変更可能
```

実行時の扱い:

```text
共有階層は管理画面上の整理に使う。
非同期エージェント実行時には、選択した skill / agent profile をフラットなリストとして workspace に渡す。
```

例:

```text
共有階層:
/team/design/skills/review.md
/team/design/skills/checklist/structural.md
/team/design/agents/design-reviewer.md

実行時:
skills = [review.md, structural.md]
agentProfiles = [design-reviewer.md]
```

------

## 4C.7 実行時の skill / agent 選択とお気に入り

実行時には、利用可能な skill / agent profile のうち、使いたいものを選択できます。

```text
選択対象:
- 共有された skill
- 自分が作成した skill
- 共有された agent profile
- 自分が作成した agent profile
```

都度選択が面倒なため、よく使う組み合わせを複数お気に入りとして保持できます。

### 型定義: `AgentExecutionPreset`（エージェント実行プリセット）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `AgentExecutionPreset` | エージェント実行プリセット | よく使うエージェント、スキル、対象フォルダ、モデル設定の組み合わせ。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `presetId` | プリセットID | 必須 | `string` | プリセットIDを一意に識別するためのIDです。 |
| `ownerUserId` | 所有者ユーザーID | 必須 | `string` | 所有者ユーザーIDを一意に識別するためのIDです。 |
| `name` | 名称 | 必須 | `string` | このデータで管理する「名称」です。 |
| `description` | 説明 | 任意 | `string` | このデータで管理する「説明」です。 |
| `provider` | 提供元 | 必須 | `AgentRuntimeProvider` | このデータで管理する「提供元」です。 |
| `modelId` | モデルID | 必須 | `string` | モデルIDを一意に識別するためのIDです。 |
| `defaultFolderIds` | 既定フォルダID一覧 | 必須 | `string[]` | 複数の既定フォルダを識別するIDの一覧です。 |
| `defaultSkillIds` | 既定スキルID一覧 | 必須 | `string[]` | 複数の既定スキルを識別するIDの一覧です。 |
| `defaultAgentProfileIds` | 既定エージェントプロファイルID一覧 | 必須 | `string[]` | 複数の既定エージェントプロファイルを識別するIDの一覧です。 |
| `defaultBudget` | 既定予算 | 任意 | `object（主な項目: maxCost, maxDurationMinutes, maxToolCalls）` | このデータで管理する「既定予算」です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


お気に入りプリセットは複数保持できます。
プリセット内のフォルダ、skill、agent profile への権限は、実行時に毎回再確認します。

------

## 4C.8 非同期エージェント画面

```text
非同期エージェント実行
  ├─ 実行指示
  ├─ 実行器: Claude Code / Codex / OpenCode / custom
  ├─ モデル
  ├─ 対象フォルダ / ファイル
  ├─ 使用する skill
  ├─ 使用する agent profile
  ├─ お気に入りプリセット
  ├─ 予算 / timeout / 最大ステップ
  ├─ 出力先
  └─ 実行
```

run 詳細画面:

```text
AsyncAgentRun 詳細
  ├─ status
  ├─ provider / model
  ├─ 実行指示
  ├─ mount されたファイル一覧
  ├─ 使用 skill / agent profile
  ├─ progress log
  ├─ 成果物
  ├─ diff / patch
  ├─ 適用 / 保存 / ダウンロード
  ├─ キャンセル
  └─ debug trace
```

------

## 4C.9 成果物と writeback

### 型定義: `AgentArtifact`（エージェント成果物）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `AgentArtifact` | エージェント成果物 | 非同期エージェントが作成したファイル、差分、レポートなど。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `artifactId` | 成果物ID | 必須 | `string` | 成果物IDを一意に識別するためのIDです。 |
| `agentRunId` | エージェント実行ID | 必須 | `string` | エージェント実行IDを一意に識別するためのIDです。 |
| `artifactType` | 成果物種別 | 必須 | `"file" / "patch" / "report" / "markdown" / "json" / "log"` | このデータで管理する「成果物種別」です。 |
| `fileName` | ファイル名 | 必須 | `string` | このデータで管理する「ファイル名」です。 |
| `mimeType` | MIMEタイプ | 必須 | `string` | このデータで管理する「MIMEタイプ」です。 |
| `size` | サイズ | 必須 | `number` | サイズを数値で管理します。 |
| `storageRef` | 保存先参照 | 必須 | `string` | このデータで管理する「保存先参照」です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |


成果物の扱い:

```text
- run artifact として保存する
- 利用者がダウンロードできる
- 指定フォルダへ保存できる
- patch / diff として確認できる
- 既存文書へ反映する場合は full 権限と明示承認が必要
```

writeback は危険操作です。

```text
writeback 前に表示する情報:
- 変更対象ファイル
- 変更前後の差分
- 影響するフォルダ
- 実行者
- 理由
- rollback 方法
```

------

## 4C.10 非同期エージェントの認可

```text
非同期エージェント実行:
agent:run
+ 選択フォルダ / 文書 readOnly 以上
+ 選択 skill / agent profile readOnly 以上

実行キャンセル:
agent:cancel
+ 自分の run または管理対象 run

成果物ダウンロード:
agent:artifact:download
+ 対象 run へのアクセス

成果物をフォルダへ保存:
agent:artifact:writeback
+ 保存先フォルダ full
+ 明示承認

skill / agent profile 作成:
skill:create または agent_profile:create
+ 対象 skill/agent folder full

skill / agent profile 共有:
skill:share または agent_profile:share
+ 対象 skill/agent folder full
```

非同期エージェントも、ユーザーの権限を超えてファイルを読めません。

```text
AsyncAgentRun が読めるファイル =
  実行時に選択された対象
  ∩ 実行ユーザーが readOnly 以上を持つフォルダ / 文書
```

------

## 4C.11 非同期エージェントの安全制約

```text
- workspace は run ごとに分離する
- mount は原則 readOnly
- writableCopy は full 権限 + 明示操作の場合のみ
- writeback は差分確認と承認を必須にする
- 実行ログから secret、token、password を除去する
- skill / agent profile の内容は prompt injection 対策として検査する
- 外部ネットワーク利用はテナント設定で制御する
- 成果物に権限外ファイル名や権限外内容を含めない
- 実行器 provider のエラーは sanitized error として表示する
```

------

## 4C.12 非同期エージェントの受け入れ条件

```text
AC-ASYNC-AGENT-001:
ユーザーは実行時に Claude Code / Codex / OpenCode / custom の実行器を選択できる。

AC-ASYNC-AGENT-002:
ユーザーは実行時にモデルを選択できる。

AC-ASYNC-AGENT-003:
実行器とモデルの既定値は個人設定で保存できる。

AC-ASYNC-AGENT-004:
共有フォルダ内ファイルは、権限確認後、元ファイルとして workspace に mount される。

AC-ASYNC-AGENT-005:
非同期エージェントは RAG chunk ではなく original file を読める。

AC-ASYNC-AGENT-006:
readOnly 権限のファイルは readOnly mount になり、元ファイルへ書き戻せない。

AC-ASYNC-AGENT-007:
writeback には対象フォルダ full と明示承認が必要。

AC-ASYNC-AGENT-008:
skill と agent profile は Markdown として作成・編集・共有できる。

AC-ASYNC-AGENT-009:
skill と agent profile はフォルダと同じ階層共有ルールを持つ。

AC-ASYNC-AGENT-010:
実行時には選択した skill / agent profile をフラットなリストとして渡す。

AC-ASYNC-AGENT-011:
よく使う provider、model、対象、skills、agent profile の組み合わせを複数プリセット保存できる。

AC-ASYNC-AGENT-012:
プリセット内の対象リソースへの権限は実行時に再確認される。

AC-ASYNC-AGENT-013:
AsyncAgentRun の status、ログ、成果物、コスト、失敗理由を確認できる。

AC-ASYNC-AGENT-014:
AsyncAgentRun はキャンセルできる。

AC-ASYNC-AGENT-015:
成果物は run artifact として保存され、必要に応じてフォルダへ保存できる。
```

------

# 5. 履歴

## 5.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Chat history | チャット履歴 | ユーザーが過去の会話を再開・確認するための記録。 |
| Escalated conversation | 問い合わせ化された会話 | 低評価や回答不能などにより担当者対応へ送られた会話。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| ChatHistoryItem | チャット履歴項目 | セッションID、所有者、タイトル、最終メッセージ、回答範囲、お気に入り状態を管理する。 |

### 守るべきルール
- 通常ユーザーは自分の履歴だけを閲覧できる。
- 問い合わせ化された会話だけ、担当者が必要範囲で閲覧できる。
- 履歴一覧には権限外フォルダ名や権限外文書名を表示しない。
- 履歴削除は文書管理や一時添付TTLに影響しない。

### 実行すべき処理
1. 履歴一覧を取得し、所有者と権限でフィルタする。
2. 履歴削除時はセッション状態をdeletedまたはarchivedに更新する。
3. 問い合わせ化された会話はsupport ticketと紐付けて閲覧範囲を管理する。

### UI
- 履歴画面に検索、日付フィルタ、お気に入りフィルタ、回答範囲フィルタを表示する。
- 権限を失った回答範囲は詳細を隠し、アクセスできない旨だけを表示する。

------

## 5.1 履歴の目的

履歴は、ユーザーが過去の会話を再開・確認するための機能です。

```text
履歴 =
自分のチャットセッション一覧
```

原則として、他人の履歴は見えません。

------

## 5.2 履歴データ

履歴は `ChatSession` そのものを一覧化します。

### 型定義: `ChatHistoryItem`（チャット履歴項目）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ChatHistoryItem` | チャット履歴項目 | 履歴一覧に表示する会話の要約情報。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `sessionId` | セッションID | 必須 | `string` | セッションIDを一意に識別するためのIDです。 |
| `ownerUserId` | 所有者ユーザーID | 必須 | `string` | 所有者ユーザーIDを一意に識別するためのIDです。 |
| `title` | タイトル | 必須 | `string` | このデータで管理する「タイトル」です。 |
| `lastMessagePreview` | 最終メッセージ抜粋 | 必須 | `string` | 最終メッセージ抜粋として表示または処理する文字列です。 |
| `lastMessageAt` | 最終メッセージ日時 | 必須 | `string` | 最終メッセージ日時を記録します。 |
| `searchScopeLabel` | 検索範囲表示名 | 任意 | `string` | 処理や設定を適用する検索範囲表示名を示します。 |
| `favorite` | お気に入り状態 | 必須 | `boolean` | お気に入り状態を有効にするか、条件を満たすかを示します。 |
| `status` | 状態 | 必須 | `"active" / "archived" / "deleted"` | 対象の現在の状態を示します。 |


------

## 5.3 履歴画面要件

```text
履歴
  ├─ 検索
  ├─ 日付フィルタ
  ├─ お気に入りフィルタ
  ├─ 回答範囲フィルタ
  ├─ セッション一覧
  └─ 削除 / アーカイブ
```

一覧で出す情報:

```text
- タイトル
- 最終メッセージ時刻
- 最終質問のプレビュー
- 回答範囲
- お気に入り状態
```

------

## 5.4 履歴削除

履歴削除は、ユーザー画面上は削除に見せます。

内部的には論理削除を基本にします。

```text
status = deleted
```

監査・コスト・セキュリティ上必要なメタデータは保持できますが、通常ユーザーには表示しません。

------

## 5.5 履歴の認可

```text
自分の履歴:
read / archive / delete 可能

他人の履歴:
不可

問い合わせ対応へ明示エスカレーションされた会話:
担当者が閲覧可能
```

管理者であっても、全ユーザーの会話本文を無条件に読める設計にはしない方がよいです。

```text
管理者:
履歴メタデータは見られる場合がある

サポート担当:
エスカレーションされた会話だけ本文閲覧可能
```

------

## 5.6 履歴の受け入れ条件

```text
AC-HISTORY-001:
ユーザーは自分のチャット履歴だけを閲覧できる。

AC-HISTORY-002:
他ユーザーの履歴は表示されない。

AC-HISTORY-003:
履歴からセッションを再開できる。

AC-HISTORY-004:
履歴削除後、そのセッションは通常一覧に出ない。

AC-HISTORY-005:
履歴削除は一時添付の TTL や文書管理には影響しない。

AC-HISTORY-006:
エスカレーションされた会話のみ、問い合わせ担当者が閲覧できる。

AC-HISTORY-007:
履歴一覧には権限外フォルダ名や権限外文書名を表示しない。
```

------

# 6. お気に入り

## 6.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Favorite | お気に入り | よく使う会話、回答、資料、フォルダ、エージェント実行プリセットを素早く再利用するための個人保存。 |
| Target | 対象 | お気に入りが指すチャット、回答、フォルダ、文書、ベンチマークrun、プリセットなど。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| Favorite | お気に入り | 所有者、対象種別、対象ID、ラベル、メモを管理する。 |

### 守るべきルール
- お気に入りは自分用であり、他人のお気に入りは閲覧しない。
- 登録後に権限を失った対象は開けない。
- フォルダお気に入りは名前だけでなく管理者と正式パスを表示する。
- お気に入り解除は対象本体を削除しない。

### 実行すべき処理
1. 対象をお気に入り登録・解除する。
2. 一覧取得時に対象への現在権限を再確認する。
3. 権限外対象は詳細を隠してアクセス不可表示にする。

### UI
- お気に入り画面で会話、回答、フォルダ、文書、ベンチマーク、エージェントプリセットを分類表示する。
- 各行に表示名、種別、最終更新、所有者/管理者/パス、自分の現在権限を表示する。

------

## 6.1 お気に入りの目的

お気に入りは、よく使う会話、回答、資料、フォルダ、非同期エージェント実行プリセットを素早く再利用するための機能です。

MVP では次を対象にします。

```text
- チャットセッション
- 回答メッセージ
- フォルダ
- 文書
- 非同期エージェント実行プリセット
- skill
- agent profile
```

将来的には、ベンチマーク run や検索テストも対象にできます。

------

## 6.2 お気に入りデータ

### 型定義: `Favorite`（お気に入り）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `Favorite` | お気に入り | よく使う会話、回答、フォルダ、文書、ベンチマークなどの個人用ショートカット。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `favoriteId` | お気に入りID | 必須 | `string` | お気に入りIDを一意に識別するためのIDです。 |
| `ownerUserId` | 所有者ユーザーID | 必須 | `string` | 所有者ユーザーIDを一意に識別するためのIDです。 |
| `targetType` | 対象種別 | 必須 | `"chatSession" / "chatMessage" / "folder" / "document" / "agentExecutionPreset" / "skill" / "agentProfile" / "benchmarkRun"` | このデータで管理する「対象種別」です。 |
| `targetId` | 対象ID | 必須 | `string` | 対象IDを一意に識別するためのIDです。 |
| `label` | ラベル | 任意 | `string` | このデータで管理する「ラベル」です。 |
| `note` | メモ | 任意 | `string` | このデータで管理する「メモ」です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |


------

## 6.3 お気に入り画面要件

```text
お気に入り
  ├─ すべて
  ├─ 会話
  ├─ 回答
  ├─ フォルダ
  ├─ 文書
  ├─ 非同期エージェント
  ├─ skill / agent profile
  └─ ベンチマーク
```

各行には次を表示します。

```text
- 表示名
- 種別
- 最終更新
- 所有者 / 管理者 / パス
- 自分の現在権限
```

フォルダ、skill、agent profile のお気に入りは、必ず管理者とパスを表示します。

```text
Aさん /xxx
group_a /team
```

名前だけを出してはいけません。

------

## 6.4 権限変更時の扱い

お気に入り登録後に権限が失われた場合、その対象は開けません。

表示は次のようにします。

```text
この項目には現在アクセスできません。
権限が変更されたか、削除された可能性があります。
```

権限外の詳細情報は出しません。

------

## 6.5 お気に入りの受け入れ条件

```text
AC-FAV-001:
ユーザーは自分用のお気に入りを登録できる。

AC-FAV-002:
他人のお気に入りは閲覧できない。

AC-FAV-003:
フォルダお気に入りには管理者とパスを表示する。

AC-FAV-004:
権限を失ったお気に入りは開けない。

AC-FAV-005:
権限外対象の存在や詳細を示唆しない。

AC-FAV-006:
チャットセッションをお気に入り解除しても履歴は削除されない。

AC-FAV-007:
文書をお気に入り解除しても文書本体は削除されない。

AC-FAV-008:
非同期エージェント実行プリセットをお気に入り登録できる。

AC-FAV-009:
skill / agent profile のお気に入りには管理者とパスを表示する。

AC-FAV-010:
お気に入り内のフォルダ、skill、agent profile への権限は利用時に再確認される。
```

------

# 6A. 個人設定

## 6A.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| User preference | 個人設定 | ユーザーごとの既定モデル、回答範囲、送信挙動、通知、表示設定、エージェント既定値。 |
| Default model | 既定モデル | チャットや非同期エージェントで最初に選択されるモデル。 |
| Send behavior | 送信挙動 | Enter送信、確認表示、ストリーミング表示など、チャット入力時の個人設定。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| UserPreference | 個人設定 | 既定モデル、既定回答範囲、エージェント既定provider/model、通知、表示設定を管理する。 |

### 守るべきルール
- 個人設定は組織ポリシーやロール制約を上書きできない。
- モデルやproviderの既定値は、利用可能権限があるものだけを保存・表示する。
- 回答範囲の既定値は、アクセス権喪失時に安全な値へ戻す。

### 実行すべき処理
1. 個人設定画面で既定モデル、回答範囲、送信挙動、通知、表示密度を保存する。
2. チャット開始時や非同期エージェント実行時に個人設定を初期値として読み込む。
3. 権限変更時に無効な既定値を検出し、利用者へ安全に通知する。

### UI
- 設定画面にチャット、モデル、エージェント、通知、表示、アクセシビリティのセクションを用意する。
- 設定保存後、次回チャットやエージェント実行画面に反映する。

------

## 6A.1 目的

個人設定は、利用者ごとの既定値と UI 挙動を保存し、毎回の選択を減らすための機能です。
ただし、個人設定は権限を拡張しません。

```text
個人設定でできること:
既定のモデル、送信方法、回答範囲、エージェント実行器、表示設定を選ぶ。

個人設定でできないこと:
権限のないフォルダを見る、許可されていないモデルを使う、禁止されたツールを有効化する。
```

------

## 6A.2 設定の優先順位

```text
1. 実行時指定
2. お気に入り / プリセット
3. 個人設定
4. グループ設定
5. テナント設定
6. システムデフォルト
```

管理者が禁止した値は、個人設定で選べません。

------

## 6A.3 個人設定データ

### 型定義: `UserPreference`（個人設定）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `UserPreference` | 個人設定 | ユーザーごとの既定モデル、送信方法、エージェント設定、表示設定など。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `userId` | ユーザーID | 必須 | `string` | ユーザーIDを一意に識別するためのIDです。 |
| `tenantId` | テナントID | 必須 | `string` | テナントIDを一意に識別するためのIDです。 |
| `chat` | チャット設定 | 必須 | `object（主な項目: defaultModelId, defaultSearchScope, sendBehavior, streamResponse, showCitationsByDefault, showAnswerScopeWarning, defaultAnswerLanguage, defaultAnswerStyle）` | このデータで管理する「チャット設定」です。 |
| `rag` | RAG設定 | 必須 | `object（主な項目: defaultTopK, preferHybridSearch, showSearchScopeBeforeSend）` | このデータで管理する「RAG設定」です。 |
| `asyncAgent` | 非同期エージェント設定 | 必須 | `"artifact_only" / "ask_each_time"` | このデータで管理する「非同期エージェント設定」です。 |
| `benchmark` | ベンチマーク設定 | 必須 | `"previous" / "baseline"` | このデータで管理する「ベンチマーク設定」です。 |
| `ui` | UI設定 | 必須 | `"system" / "light" / "dark" / "comfortable" / "compact"` | このデータで管理する「UI設定」です。 |
| `notifications` | 通知設定 | 必須 | `object（主な項目: notifyAgentRunCompleted, notifySupportTicketUpdated, notifyBenchmarkCompleted）` | このデータで管理する「通知設定」です。 |
| `privacy` | プライバシー設定 | 必須 | `object（主な項目: saveChatHistory, allowPersonalizedSuggestions）` | このデータで管理する「プライバシー設定」です。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


------

## 6A.4 チャット送信まわりの設定

```text
- Enter で送信 / Cmd+Enter または Ctrl+Enter で送信
- 送信前に回答範囲を強調表示する
- 既定モデル
- 既定回答範囲
- streaming 表示の ON/OFF
- citation を最初から展開するか
- 既定回答言語
- 既定回答の詳しさ
- 会話圧縮の ON/OFF
```

送信前の安全表示:

```text
[回答範囲: group_a /team]
[モデル: xxx]
[一時添付: 2件]
[送信]
```

回答範囲が広い場合や、一時添付が含まれる場合は、設定に応じて警告を表示できます。

------

## 6A.5 非同期エージェント設定

```text
- 既定の実行器: Claude Code / Codex / OpenCode / custom
- 既定モデル
- 既定 skill
- 既定 agent profile
- 既定お気に入りプリセット
- 既定 timeout
- 既定予算
- 成果物の扱い: artifact のみ / 毎回確認して保存
- run 完了通知
```

非同期エージェントの既定値は、実行画面で上書きできます。

------

## 6A.6 その他あるとよい設定

```text
表示:
- theme
- density
- timezone
- 日付形式

通知:
- エージェント完了通知
- 問い合わせ更新通知
- benchmark 完了通知

プライバシー:
- チャット履歴保存の既定値
- 個人化提案の利用可否

デバッグ表示:
- 自分の run で user_safe trace を表示するか
- 運用者向け trace 表示は権限がある場合のみ

コスト:
- 個人の月次利用量表示
- 高コスト実行前の確認
```

------

## 6A.7 個人設定の受け入れ条件

```text
AC-PREF-001:
ユーザーは自分の個人設定を閲覧・更新できる。

AC-PREF-002:
個人設定は feature permission と resource permission を拡張しない。

AC-PREF-003:
管理者が許可していないモデル、provider、tool は個人設定に保存できない。

AC-PREF-004:
チャット送信方式を Enter / Cmd+Enter または Ctrl+Enter から選べる。

AC-PREF-005:
チャットの既定モデル、既定回答範囲、既定回答スタイルを保存できる。

AC-PREF-006:
非同期エージェントの既定 provider、model、skills、agent profile を保存できる。

AC-PREF-007:
個人設定に保存されたフォルダや skill への権限は、利用時に再確認される。

AC-PREF-008:
個人設定変更は updatedAt を更新し、必要な場合は監査ログに残る。
```

------

# 7. 問い合わせ対応

## 7.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Support ticket | 問い合わせチケット | 低評価、回答不能、利用者からの確認依頼を担当者が処理する単位。 |
| Assignee | 担当者 | 問い合わせに対応するユーザーまたはチーム。 |
| SLA | 対応期限 | 問い合わせへの初動や解決に求められる期限。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| SupportTicket | 問い合わせチケット | 発生元、対象会話、依頼者、担当者、状態、カテゴリを管理する。 |

### 守るべきルール
- 問い合わせ担当者は、問い合わせ化された会話だけを必要範囲で閲覧する。
- 担当者に渡す情報はsanitizedされた情報に限定する。
- 問い合わせ対応履歴は監査ログに残す。
- 対応完了時は回答改善、文書改善、検索改善へつなげる。

### 実行すべき処理
1. 低評価、answer_unavailable、手動エスカレーションからチケットを作成する。
2. 担当者を割り当て、状態をopen、in_progress、resolved、closedで管理する。
3. 問い合わせ内容から検索改善候補、文書検証依頼、ベンチマークケースを作る。

### UI
- 問い合わせ対応画面で未対応、対応中、解決済み、SLA超過、担当者別に表示する。
- 詳細画面に元質問、AI回答、citation、利用者フィードバック、担当者メモ、改善候補を表示する。

------

## 7.1 目的

問い合わせ対応は、低評価、回答不能、利用者からの確認依頼を担当者が処理する機能です。

```text
問い合わせ対応 =
回答品質改善の入口
```

------

## 7.2 問い合わせデータ

### 型定義: `SupportTicket`（問い合わせチケット）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `SupportTicket` | 問い合わせチケット | 低評価、回答不能、手動依頼から担当者対応に回すための管理単位。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `ticketId` | 問い合わせチケットID | 必須 | `string` | 問い合わせチケットIDを一意に識別するためのIDです。 |
| `source` | 発生元 | 必須 | `"negative_feedback" / "answer_unavailable" / "manual_escalation"` | このデータで管理する「発生元」です。 |
| `sessionId` | セッションID | 必須 | `string` | セッションIDを一意に識別するためのIDです。 |
| `messageId` | メッセージID | 必須 | `string` | メッセージIDを一意に識別するためのIDです。 |
| `requesterUserId` | 依頼者ユーザーID | 必須 | `string` | 依頼者ユーザーIDを一意に識別するためのIDです。 |
| `assigneeUserId` | 担当者ユーザーID | 任意 | `string` | 担当者ユーザーIDを一意に識別するためのIDです。 |
| `status` | 状態 | 必須 | `"open" / "in_progress" / "resolved" / "closed"` | 対象の現在の状態を示します。 |
| `category` | 分類 | 任意 | `"missing_document" / "bad_search" / "wrong_answer" / "permission_issue" / "other"` | このデータで管理する「分類」です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


------

## 7.3 問い合わせ画面要件

```text
問い合わせ対応
  ├─ 未対応
  ├─ 対応中
  ├─ 解決済み
  ├─ SLA超過
  └─ 担当者別
```

詳細画面:

```text
- 元の質問
- AI回答
- citation
- 利用者フィードバック
- 検索結果の概要
- 担当者メモ
- 回答案
- 関連フォルダ / 文書
- 検索改善候補
```

------

## 7.4 認可

問い合わせ対応には専用権限が必要です。

```text
support:ticket:read
support:ticket:update
```

ただし、担当者が閲覧できるのは次に限ります。

```text
- 明示的に問い合わせ化された会話
- 自分が担当している問い合わせ
- 担当チームに割り当てられた問い合わせ
```

------

## 7.5 受け入れ条件

```text
AC-SUPPORT-001:
低評価回答から問い合わせを作成できる。

AC-SUPPORT-002:
担当者は問い合わせ化された会話のみ閲覧できる。

AC-SUPPORT-003:
問い合わせから検索改善候補を作成できる。

AC-SUPPORT-004:
問い合わせから関連フォルダや文書へ遷移できる。

AC-SUPPORT-005:
問い合わせ完了時に対応メモを残す。

AC-SUPPORT-006:
問い合わせ対応履歴は監査ログに残る。
```

------

# 7A. 回答不能・担当者対応の詳細

## 7A.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Answer unavailable | 回答不能 | 根拠不足、権限不足、品質不足、矛盾などにより安全に回答できない状態。 |
| Sanitized diagnostics | 無害化済み診断情報 | 権限外情報や内部推論を除いた、担当者対応に必要な診断情報。 |
| Support draft answer | 問い合わせ回答案 | 担当者が利用者へ返すための下書き回答。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| SupportTicket | 問い合わせチケット | 回答不能起点のチケット情報を拡張して管理する。 |
| SupportDraftAnswer | 問い合わせ回答案 | 担当者が確認・編集できる回答案を管理する。 |

### 守るべきルール
- 根拠不足時は推測回答せずanswer_unavailableを返す。
- 権限外資料の存在や内部ポリシーを利用者に示唆しない。
- 担当者へ渡す情報も権限と無害化レベルに応じて制御する。
- 同種の回答不能は改善候補やベンチマークケース化する。

### 実行すべき処理
1. 回答不能理由を分類して保存する。
2. 利用者が希望した場合、support ticketを作成する。
3. 担当者画面へ元質問、回答不能理由、権限内citation候補、sanitized diagnosticsを渡す。
4. 担当者対応後、改善アクションへ接続する。

### UI
- 回答不能表示には、何が不足したか、次にできること、問い合わせ作成ボタンを表示する。
- 担当者画面では、権限内情報だけで診断概要と回答案を確認できる。

------

## 7A.1 基本方針

rag-assist は、回答できない質問に対して無理に回答しません。

```text
根拠がある → citation 付きで回答
根拠が不足 → 回答不能として扱う
人間確認が必要 → 担当者対応へ送る
```

回答不能は失敗ではなく、誤回答を防ぐための正常な分岐です。

------

## 7A.2 担当者対応へ送る条件

次の場合、担当者対応への導線を表示します。

```text
- 検索結果が 0 件
- 検索結果はあるが回答根拠として不十分
- 利用者が低評価を付けた
- 利用者が「担当者に確認」を押した
- 質問が曖昧で、人間判断が必要
- 資料不足が疑われる
- 権限・共有設定の問題が疑われる
- ツール実行が必要だが、ユーザーまたは agent に権限がない
```

ただし、権限外資料の存在を示唆してはいけません。

------

## 7A.3 SupportTicket 拡張

既存の `SupportTicket` に、回答不能の診断情報と担当先を追加します。

### 型定義: `SupportTicket`（問い合わせチケット）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `SupportTicket` | 問い合わせチケット | 低評価、回答不能、手動依頼から担当者対応に回すための管理単位。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `ticketId` | 問い合わせチケットID | 必須 | `string` | 問い合わせチケットIDを一意に識別するためのIDです。 |
| `source` | 発生元 | 必須 | `"negative_feedback" / "answer_unavailable" / "manual_escalation"` | このデータで管理する「発生元」です。 |
| `sessionId` | セッションID | 必須 | `string` | セッションIDを一意に識別するためのIDです。 |
| `messageId` | メッセージID | 必須 | `string` | メッセージIDを一意に識別するためのIDです。 |
| `ragRunId` | RAG実行ID | 任意 | `string` | RAG実行IDを一意に識別するためのIDです。 |
| `answerUnavailableEventId` | 回答不能イベントID | 任意 | `string` | 回答不能イベントIDを一意に識別するためのIDです。 |
| `requesterUserId` | 依頼者ユーザーID | 必須 | `string` | 依頼者ユーザーIDを一意に識別するためのIDです。 |
| `assigneeUserId` | 担当者ユーザーID | 任意 | `string` | 担当者ユーザーIDを一意に識別するためのIDです。 |
| `assigneeGroupId` | 担当グループID | 任意 | `string` | 担当グループIDを一意に識別するためのIDです。 |
| `status` | 状態 | 必須 | `"open" / "in_progress" / "waiting_for_user" / "waiting_for_knowledge_owner" / "resolved" / "closed"` | 対象の現在の状態を示します。 |
| `category` | 分類 | 任意 | `"missing_document" / "bad_search" / "wrong_answer" / "permission_issue" / "ambiguous_question" / "tool_issue" / "other"` | このデータで管理する「分類」です。 |
| `priority` | 優先度 | 任意 | `"low" / "normal" / "high" / "urgent"` | このデータで管理する「優先度」です。 |
| `requesterComment` | 依頼者コメント | 任意 | `string` | このデータで管理する「依頼者コメント」です。 |
| `assigneeNote` | 担当者メモ | 任意 | `string` | このデータで管理する「担当者メモ」です。 |
| `resolutionSummary` | 解決要約 | 任意 | `string` | このデータで管理する「解決要約」です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |
| `resolvedAt` | 解決日時 | 任意 | `string` | 解決日時を記録します。 |


------

## 7A.4 担当者に渡す情報

担当者に渡す情報は、問い合わせ対応に必要な範囲に限定します。

```text
渡す:
- 元の質問
- AI回答または回答不能メッセージ
- 利用者コメント
- 回答範囲ラベル
- citation
- 権限内の検索結果概要
- answerUnavailableReason
- sanitized diagnostics

渡さない:
- 権限外文書名
- 権限外フォルダ名
- 権限外検索ヒット数
- 内部 policy group の詳細
- LLM の非公開推論過程
```

担当者が文書へ遷移する場合も、担当者自身の resource permission を確認します。

------

## 7A.5 担当者の対応アクション

担当者は、問い合わせから次の対応を行えます。

```text
- 回答案を作成する
- 利用者へ返信する
- 関連文書を案内する
- ナレッジ不足として文書追加を依頼する
- 検索改善候補を作成する
- 権限問題としてアクセス管理者へ回す
- 文書管理者へ再インデックスを依頼する
- チケットをクローズする
```

検索改善候補の作成はできますが、自動公開はできません。

------

## 7A.6 回答案

### 型定義: `SupportDraftAnswer`（問い合わせ回答案）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `SupportDraftAnswer` | 問い合わせ回答案 | 担当者が利用者に返すための下書き回答。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `draftAnswerId` | 回答案ID | 必須 | `string` | 回答案IDを一意に識別するためのIDです。 |
| `ticketId` | 問い合わせチケットID | 必須 | `string` | 問い合わせチケットIDを一意に識別するためのIDです。 |
| `content` | 本文 | 必須 | `string` | 本文として表示または処理する文字列です。 |
| `citations` | 引用一覧 | 必須 | `Citation[]` | このデータで管理する「引用一覧」です。 |
| `createdBy` | 作成者ID | 必須 | `string` | 作成者IDを示します。 |
| `reviewedBy` | レビュー者 | 任意 | `string` | レビュー者を示します。 |
| `status` | 状態 | 必須 | `"draft" / "review_requested" / "approved" / "sent" / "rejected"` | 対象の現在の状態を示します。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


担当者の回答にも citation を付けられるようにします。citation には、利用者がアクセスできる文書だけを含めます。

------

## 7A.7 担当者対応後の改善ループ

問い合わせ対応は、ナレッジ改善へつなげます。

```text
回答不能
  ↓
問い合わせ作成
  ↓
担当者が原因分類
  ↓
対応
  ├─ 文書追加
  ├─ 文書修正
  ├─ 検索改善候補
  ├─ チャンク化 / 再インデックス見直し
  └─ 権限設定見直し
  ↓
必要に応じて benchmark case 化
```

同じ種類の回答不能が繰り返される場合、検索改善候補または benchmark case を作成します。

------

## 7A.8 担当者対応の受け入れ条件

```text
AC-UNANSWERABLE-001:
根拠が不十分な場合、AI は推測回答ではなく answer_unavailable を返す。

AC-UNANSWERABLE-002:
answer_unavailable から SupportTicket を作成できる。

AC-UNANSWERABLE-003:
担当者に渡す診断情報は sanitize され、権限外文書を含まない。

AC-UNANSWERABLE-004:
SupportTicket は ragRunId または messageId から元の質問を追跡できる。

AC-UNANSWERABLE-005:
担当者の回答 citation は、利用者が readOnly 以上を持つ文書だけに限定する。

AC-UNANSWERABLE-006:
問い合わせ対応から検索改善候補を作成できるが、自動公開はしない。

AC-UNANSWERABLE-007:
問い合わせ完了時に resolutionSummary を必須にする。

AC-UNANSWERABLE-008:
回答不能の発生件数、理由、解決状況を管理ダッシュボードで確認できる。

AC-UNANSWERABLE-009:
同種の回答不能を benchmark case として登録できる。

AC-UNANSWERABLE-010:
問い合わせ作成・担当変更・返信・クローズは監査ログに残る。
```

------


# 7B. 品質起因の担当者対応・改善ループ

## 7B.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Quality-related ticket | 品質起因問い合わせ | 未検証、期限切れ、低OCR、表抽出失敗など、文書品質が原因で発生した問い合わせ。 |
| Improvement loop | 改善ループ | 問い合わせや低評価から、文書検証、再解析、検索改善、ベンチマークへつなげる運用サイクル。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| SupportTicketQualityCategory | 問い合わせ品質分類 | 品質起因の問い合わせ理由を分類する。 |

### 守るべきルール
- 品質起因の回答不能は単なる検索失敗として扱わず、文書品質改善へつなげる。
- 品質診断情報は担当者権限に応じて無害化して表示する。
- RAG除外、検証依頼、再解析依頼は監査対象にする。

### 実行すべき処理
1. 品質起因のチケットを分類する。
2. 文書オーナー確認、検証依頼、再OCR、表レビュー、旧版化、RAG除外を作成する。
3. 解決後に同種失敗をベンチマークケースへ登録する。

### UI
- 問い合わせ詳細に品質分類、対象文書、品質バッジ、推奨改善アクションを表示する。
- 文書詳細や品質ダッシュボードへ遷移できる。

------

## 7B.1 基本方針

品質起因の `answer_unavailable` や低評価は、検索改善だけでなく、文書検証、文書更新、再解析、RAG除外に接続します。

```text
quality_related answer_unavailable
  ↓
SupportTicket 作成
  ↓
sanitized diagnostics 付与
  ↓
担当者が原因を分類
  ↓
文書検証 / 再解析 / RAG除外 / 新版追加 / benchmark case 登録
```

## 7B.2 SupportTicket の品質分類

`SupportTicket.category` は、品質起因の原因を表せるように拡張します。

### 型定義: `SupportTicketQualityCategory`（問い合わせ品質分類）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `SupportTicketQualityCategory` | 問い合わせ品質分類 | 回答不能や低評価が、文書品質、OCR、表抽出など何に起因するかの分類。 |

| 英名（値） | 日本語名 | 内容 |
|---|---|---|
| `stale_document` | 古い・文書 | 仕様上の値「stale_document」を表します。 |
| `expired_document` | 期限切れ・文書 | 仕様上の値「expired_document」を表します。 |
| `unverified_document` | 未検証・文書 | 仕様上の値「unverified_document」を表します。 |
| `verification_expired` | 検証期限切れ | 以前は検証済みだが有効期限を過ぎている。 |
| `superseded_document` | superseded・文書 | 仕様上の値「superseded_document」を表します。 |
| `low_ocr_confidence` | OCR低信頼 | OCR結果の信頼度が低い。 |
| `table_extraction_issue` | 表抽出問題 | 表抽出に問題がある。 |
| `figure_analysis_issue` | 図解析問題 | 図の解析に問題がある。 |
| `parse_failed` | parse・失敗 | 仕様上の値「parse_failed」を表します。 |
| `conflicting_content` | 内容矛盾 | 他文書と矛盾している可能性がある。 |
| `missing_owner` | オーナー未設定 | 文書責任者が設定されていない。 |
| `missing_review_date` | レビュー期限未設定 | レビュー期限が設定されていない。 |


担当者に渡す品質診断は sanitized された情報に限定します。

```text
渡してよい:
- ユーザーがアクセスできる根拠の品質警告
- answer_unavailable の quality_related reason
- 対象範囲内の品質起因失敗分類
- OCR / 表 / 図の低信頼が原因であること
- 担当者が権限を持つ文書の文書名、ページ、tableId、figureId

渡してはいけない:
- 権限外文書名
- 権限外フォルダ名
- 権限外文書の品質状態
- 内部 policy の全文
- LLM の内部推論
```

## 7B.3 担当者の対応アクション

```text
- 文書を検証済みにする
- 文書オーナーへ確認依頼を送る
- 文書をRAG対象から除外する
- 旧版 / 置き換え済みとしてマークする
- 新版文書の追加を依頼する
- OCR再実行を依頼する
- 表抽出結果を修正する
- 図説明を補正する
- チャンク化設定の見直しを依頼する
- benchmark case に登録する
```

## 7B.4 受け入れ条件

```text
AC-SUPPORT-KQ-001:
quality_related answer_unavailable から SupportTicket を作成できる。

AC-SUPPORT-KQ-002:
SupportTicket には sanitized された品質診断情報のみを渡す。

AC-SUPPORT-KQ-003:
問い合わせ対応画面から、文書検証依頼、文書オーナー確認、RAG除外、再解析依頼を作成できる。

AC-SUPPORT-KQ-004:
品質起因の低評価・回答不能は、検索改善だけでなく、文書検証・再解析・文書更新の候補として扱える。

AC-SUPPORT-KQ-005:
問い合わせから作成された品質改善アクションは監査ログに記録される。
```

------

# 8. 検索改善

## 8.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Search improvement | 検索改善 | 利用者の質問語と資料内表現のズレを減らす運用機能。 |
| Search term mapping | 検索語対応づけ | 質問語、別名、略称、同義語を検索に反映するルール。 |
| Alias | エイリアス | 内部的な検索語対応づけの概念。ただしUIでは「alias」という表記は使わない。 |
| Review / publish | 確認 / 公開 | AI候補や編集済みルールを人間が確認し、検索に反映する操作。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| SearchTermMapping | 検索語対応づけ | 元語、展開語、範囲、状態、作成者、確認者、公開者を管理する。 |

### 守るべきルール
- AIは検索改善候補を作れるが、自動公開しない。
- 検索改善ルールはユーザーの閲覧権限を拡張しない。
- 公開前に検索結果差分と影響範囲を確認する。
- UIにはaliasという表記を出さない。

### 実行すべき処理
1. 検索0件、低評価、問い合わせ、回答不能から候補を生成する。
2. 管理者が候補を確認し、差分テストを実行する。
3. 承認後に公開し、公開履歴を監査ログへ記録する。

### UI
- 検索改善画面に候補、確認待ち、公開済み、停止中、検索テスト、変更履歴を表示する。
- 公開操作では変更前後、検索結果差分、理由入力を表示する。

------

## 8.1 目的

検索改善は、利用者の質問語と資料内の表現のズレを減らす機能です。

UI では `alias` とは呼びません。

```text
画面名:
検索改善

機能名:
検索語の対応づけ
AIが見つけた言い換え候補
承認済みの言い換えルール
```

------

## 8.2 検索改善データ

### 型定義: `SearchTermMapping`（検索語対応づけ）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `SearchTermMapping` | 検索語対応づけ | 利用者の表現と文書内の表現の違いを埋める検索改善ルール。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `mappingId` | 対応づけID | 必須 | `string` | 対応づけIDを一意に識別するためのIDです。 |
| `sourceTerm` | 元検索語 | 必須 | `string` | このデータで管理する「元検索語」です。 |
| `expansionTerms` | 展開語一覧 | 必須 | `string[]` | このデータで管理する「展開語一覧」です。 |
| `scopeType` | スコープ種別 | 必須 | `"global" / "folder" / "group"` | 処理や設定を適用するスコープ種別を示します。 |
| `scopeId` | 範囲ID | 任意 | `string` | 範囲IDを一意に識別するためのIDです。 |
| `status` | 状態 | 必須 | `"draft" / "pending_review" / "approved" / "published" / "disabled"` | 対象の現在の状態を示します。 |
| `createdBy` | 作成者ID | 必須 | `string` | 作成者IDを示します。 |
| `reviewedBy` | レビュー者 | 任意 | `string` | レビュー者を示します。 |
| `publishedBy` | 公開者 | 任意 | `string` | 公開者を示します。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


------

## 8.3 AI候補

AI は失敗クエリ、低評価、問い合わせ、検索結果 0 件から候補を出します。

```text
AIが候補を作る
  ↓
管理者が確認する
  ↓
検索結果差分を見る
  ↓
検索に反映する
```

------

## 8.4 検索改善画面

```text
検索改善
  ├─ 検索で見つからなかった質問
  ├─ AIが見つけた候補
  ├─ 確認待ち
  ├─ 検索に反映済み
  ├─ 停止中
  ├─ 検索テスト
  └─ 変更履歴
```

------

## 8.5 認可

```text
search_improvement:read
search_improvement:suggest
search_improvement:review
search_improvement:publish
search_improvement:disable
```

公開操作は危険操作です。

```text
- 変更前
- 変更後
- 影響範囲
- 検索結果差分
- 理由入力
```

------

## 8.6 受け入れ条件

```text
AC-SEARCHIMP-001:
alias という表記を UI に出さない。

AC-SEARCHIMP-002:
AI は検索改善候補を作れるが、自動公開しない。

AC-SEARCHIMP-003:
検索に反映するには review / publish 権限が必要。

AC-SEARCHIMP-004:
公開前に検索結果差分を確認できる。

AC-SEARCHIMP-005:
差戻しには理由入力を必須とする。

AC-SEARCHIMP-006:
公開済みルールは監査ログに残る。

AC-SEARCHIMP-007:
検索改善ルールはユーザーの閲覧権限を拡張しない。
```

------

# 9. 評価・ベンチマーク

## 9.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Benchmark | ベンチマーク | RAGやエージェントの品質が改善したかを判断する評価機能。 |
| Benchmark suite | ベンチマークスイート | 複数の評価ケースをまとめたセット。 |
| Benchmark case | ベンチマークケース | 1つの質問、期待回答、期待根拠を持つ評価項目。 |
| Benchmark run | ベンチマーク実行 | スイートを特定設定で実行し、結果を出す単位。 |
| Promotion gate | 本番反映ゲート | 精度、引用、遅延、コスト、重大劣化なしなど、本番採用の基準。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| BenchmarkSuite | ベンチマークスイート | 評価ケースの集合を管理する。 |
| BenchmarkUseCase | ベンチマークユースケース | 評価対象の業務ユースケースを分類する。 |
| BenchmarkCase | ベンチマークケース | 質問、期待回答、期待文書、タグを管理する。 |
| BenchmarkRun | ベンチマーク実行 | 実行状態、対象設定、指標、作成者、完了時刻を管理する。 |

### 守るべきルール
- ベンチマークはジョブ実行画面ではなく品質判断の画面として設計する。
- 実フォルダを評価対象にする場合、対象フォルダreadOnly以上が必要。
- benchmark用資料は通常チャットの検索対象に混ぜない。
- 本番反映にはbenchmark結果だけでなくpromotion gate通過が必要。

### 実行すべき処理
1. suiteとcaseを作成し、評価対象設定を選ぶ。
2. benchmark runを起動し、検索、回答、citation、遅延、コストを測定する。
3. 失敗ケースを確認し、改善タスクへ変換する。
4. 本番反映前にpromotion gateを評価する。

### UI
- ベンチマーク画面に最新run合否、前回比、suite別スコア、失敗ケース、latency、成果物DLを表示する。
- 合否理由を非技術者にも分かる文言で表示する。

------

## 9.1 目的

ベンチマークは、RAG の品質が改善したか、本番反映してよいかを判断するための機能です。

```text
ベンチマーク =
ジョブ実行画面ではなく品質ゲート
```

------

## 9.2 ベンチマークスイート

### 型定義: `BenchmarkSuite`（ベンチマークスイート）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `BenchmarkSuite` | ベンチマークスイート | 評価ケースをまとめたテストセット。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `suiteId` | スイートID | 必須 | `string` | スイートIDを一意に識別するためのIDです。 |
| `name` | 名称 | 必須 | `string` | このデータで管理する「名称」です。 |
| `description` | 説明 | 任意 | `string` | このデータで管理する「説明」です。 |
| `status` | 状態 | 必須 | `"active" / "archived"` | 対象の現在の状態を示します。 |
| `createdBy` | 作成者ID | 必須 | `string` | 作成者IDを示します。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


------

## 9.3 ベンチマークケース

### 型定義: `BenchmarkUseCase`（ベンチマークユースケース）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `BenchmarkUseCase` | ベンチマークユースケース | マルチターン、図面QA、社内QA、長大PDFなど、評価対象の利用場面。 |

| 英名（値） | 日本語名 | 内容 |
|---|---|---|
| `multiturn_chat` | マルチターンチャット | 複数ターンの会話を評価するユースケース。 |
| `design_drawing_qa` | 設計図面QA | 図面・設計資料への質疑応答を評価するユースケース。 |
| `internal_qa` | 社内相談QA | 社内規程・業務相談への回答を評価するユースケース。 |
| `long_pdf_qa` | 長大PDF QA | 500ページ超など長いPDFへの質疑応答を評価するユースケース。 |
| `async_agent_task` | 非同期エージェントタスク | 非同期エージェント作業を評価するユースケース。 |


### 型定義: `BenchmarkCase`（ベンチマークケース）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `BenchmarkCase` | ベンチマークケース | 1つの質問、期待回答、期待文書、タグを持つ評価項目。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `caseId` | ケースID | 必須 | `string` | ケースIDを一意に識別するためのIDです。 |
| `suiteId` | スイートID | 必須 | `string` | スイートIDを一意に識別するためのIDです。 |
| `useCase` | ユースケース | 必須 | `BenchmarkUseCase` | このデータで管理する「ユースケース」です。 |
| `question` | 質問 | 必須 | `string` | このデータで管理する「質問」です。 |
| `turns` | 会話ターン一覧 | 任意 | `"user" / "assistant"` | このデータで管理する「会話ターン一覧」です。 |
| `expectedAnswer` | 期待回答 | 任意 | `string` | このデータで管理する「期待回答」です。 |
| `expectedDocumentIds` | 期待文書ID一覧 | 任意 | `string[]` | 複数の期待文書を識別するIDの一覧です。 |
| `expectedChunkIds` | 期待チャンクID一覧 | 任意 | `string[]` | 複数の期待チャンクを識別するIDの一覧です。 |
| `expectedPages` | 期待ページ一覧 | 任意 | `number[]` | 期待ページ一覧を数値で管理します。 |
| `expectedMetadata` | 期待メタデータ | 任意 | `Record<string, unknown>` | 期待メタデータとして補足情報を保持します。 |
| `answerUnavailableExpected` | 回答不能期待 | 任意 | `boolean` | 回答不能期待を有効にするか、条件を満たすかを示します。 |
| `tags` | タグ一覧 | 必須 | `string[]` | このデータで管理する「タグ一覧」です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


------

## 9.4 ベンチマーク run

### 型定義: `BenchmarkRun`（ベンチマーク実行）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `BenchmarkRun` | ベンチマーク実行 | スイートを対象設定で実行し、精度・速度・コストを測る単位。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `runId` | 実行ID | 必須 | `string` | 実行IDを一意に識別するためのIDです。 |
| `suiteId` | スイートID | 必須 | `string` | スイートIDを一意に識別するためのIDです。 |
| `status` | 状態 | 必須 | `"queued" / "running" / "completed" / "failed" / "cancelled"` | 対象の現在の状態を示します。 |
| `targetConfig` | 対象設定 | 必須 | `object（主な項目: modelId, embeddingModelId, retrieverVersion, rerankerVersion, chunkerVersion, promptVersion, contextCompressionVersion, indexVersion）` | 対象設定として実行条件をまとめます。 |
| `metrics` | 指標 | 任意 | `object（主な項目: accuracy, recallAtK, mrr, ndcg, latencyP50, latencyP95, errorRate）` | このデータで管理する「指標」です。 |
| `createdBy` | 作成者ID | 必須 | `string` | 作成者IDを示します。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `completedAt` | 完了日時 | 任意 | `string` | 完了日時を記録します。 |


------

## 9.5 ベンチマーク画面要件

```text
評価・ベンチマーク
  ├─ 最新runの合否
  ├─ 前回比
  ├─ suite別スコア
  ├─ 失敗ケース
  ├─ latency
  ├─ error rate
  ├─ run履歴
  ├─ 成果物DL
  └─ 新規実行
```

主役はジョブ起動ではなく、判断です。

```text
最新run:
不合格

理由:
- recall@5 が基準未満
- 人事系ケースで 4 件失敗
- latency p95 が上限超過
```

------

## 9.6 ベンチマークの認可

```text
benchmark:read
benchmark:suite:create
benchmark:suite:update
benchmark:case:create
benchmark:case:update
benchmark:run
benchmark:cancel
benchmark:artifact:download
```

ベンチマークが実フォルダを検索対象にする場合、そのフォルダに `readOnly` 以上が必要です。

```text
benchmark:run
+ 対象フォルダ readOnly 以上
```

本番設定への反映は別権限にします。

```text
benchmark:promote_result
```

------

## 9.7 ベンチマークの受け入れ条件

```text
AC-BENCH-001:
benchmark:run を持つユーザーは benchmark run を開始できる。

AC-BENCH-002:
対象フォルダに readOnly 以上がない場合、そのフォルダを benchmark 対象にできない。

AC-BENCH-003:
run 詳細では前回比を確認できる。

AC-BENCH-004:
失敗ケースを確認できる。

AC-BENCH-005:
run をキャンセルできるのは実行者または benchmark 管理者。

AC-BENCH-006:
成果物DLには benchmark:artifact:download が必要。

AC-BENCH-007:
benchmark 用資料は通常チャットの検索対象に混ぜない。

AC-BENCH-008:
本番反映には benchmark:promote_result が必要。
```

------

# 9A. チャット・RAG・非同期エージェントのベンチマーク設計

## 9A.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Benchmark pipeline | ベンチマークパイプライン | データ準備、取り込み、検索評価、回答評価、比較、成果物出力の一連の工程。 |
| benchmark_grounded_short | ベンチマーク用根拠付き短答 | 評価用に、資料外補足を禁止し短く根拠付きで回答する回答方針。 |
| Use case | ユースケース | マルチターン、図面QA、社内相談QA、長大PDF QAなど、評価対象となる業務場面。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| BenchmarkPipeline | ベンチマークパイプライン | 評価工程の構成、順序、成果物を管理する。 |
| BenchmarkStage | ベンチマーク工程 | データ準備、検索、回答、検証など個別工程を管理する。 |
| BenchmarkTargetConfig | ベンチマーク対象設定 | モデル、retriever、index、検索改善バージョンを管理する。 |
| PromotionGate | 本番反映ゲート | 本番採用の合否基準を管理する。 |
| BenchmarkAnswerPolicy | ベンチマーク回答ポリシー | 評価専用の回答スタイルや拒否文言を管理する。 |

### 守るべきルール
- 通常利用者向け回答policyとbenchmark用回答policyを分ける。
- dataset固有IDに依存せず、metadataで回答policyを切り替える。
- マルチターン、図面、社内QA、500P超PDFを明示的な評価対象にする。
- 評価結果は再現できるように設定、corpus、artifactを保存する。

### 実行すべき処理
1. 評価対象ユースケースを選定する。
2. benchmark用corpusを準備し、通常検索対象から隔離する。
3. 検索、rerank、回答生成、citation検証、support検証、マルチターン検証を実行する。
4. 前回比とpromotion gateを計算し、成果物を出力する。

### UI
- ベンチマーク詳細画面にpipelineの各工程、指標、失敗理由、成果物を表示する。
- 非技術者向けには「本番反映可/不可」と主な理由を先に表示する。

------

## 9A.1 対象ユースケース

ベンチマークでは、通常の一問一答だけでなく、実運用で重要な次のユースケースを評価対象にします。

| useCase tag | 対象 | 代表ケース | 主な評価観点 |
|---|---|---|---|
| `multiturn_chat` | マルチターンチャット | 前提条件を途中で変えた相談、過去回答の続き質問 | 文脈追従、query rewrite、圧縮後の情報保持、不要情報の無視 |
| `design_drawing_qa` | 設計業界の図面 | 図面番号、改訂、尺度、注記、部材表、レイヤー、BIM entity | 図面 metadata 抽出、title block 認識、OCR、spatial reference、citation |
| `internal_qa` | 社内相談QA | 規程、手順、申請、FAQ、社内用語 | 権限内回答、根拠提示、検索語対応づけ、回答不能時の担当者対応 |
| `long_pdf_qa` | 500ページ超PDF | 長大仕様書、契約書、マニュアル、設計基準 | 長文検索、章節 metadata、parent-child chunk、ページ citation、要約品質 |
| `async_agent_task` | 非同期エージェント | 複数ファイル調査、仕様差分抽出、Markdown生成、レポート作成 | raw file 利用、成果物品質、実行成功率、コスト、承認フロー |

------

## 9A.2 先行研究・手法の採用方針

ベンチマークと改善方針では、次の研究・手法を参照します。

| 領域 | 参照する研究・手法 | rag-assist での使い方 |
|---|---|---|
| RAG基盤 | RAG, DPR, FiD | retrieval と生成を分離し、根拠付き回答を評価する |
| hybrid retrieval | BM25, dense retrieval, Reciprocal Rank Fusion, ColBERT | lexical と semantic の併用、fusion、rerank の比較に使う |
| query rewrite | QReCC, conversational query rewriting, HyDE | マルチターンの省略質問や社内用語ズレを検索可能な query に変換する |
| reranking | cross-encoder reranking, monoT5 | 上位 evidence の精度向上を recall / nDCG / MRR で評価する |
| 長文・階層検索 | RAPTOR, parent-child retrieval, LongRAG 系 | 500P超PDFで章節・親子chunk・要約indexの効果を見る |
| context compression | LLMLingua, LongLLMLingua, Selective Context | 長い会話・長い evidence の圧縮率と回答品質を評価する |
| 長文利用の注意 | Lost in the Middle | 長大contextへ単純投入せず、位置バイアスを考慮した構成にする |
| self-check | Self-RAG, RAGAS | faithfulness、context precision、context recall、回答不能判定を評価する |
| tool / agent | ReAct, Toolformer, MRKL | ツール選択、ツール実行、観測結果の統合を評価する |
| 文書・図表 | DocVQA, ChartQA, PubLayNet, DocLayNet | 図面・表・レイアウト抽出の内部 benchmark 設計に使う |
| grounded answer | ALCE, Attributable QA, FEVER / NLI 系評価 | citation と回答文の支持関係、unsupported sentence の検出に使う |
| マルチターンRAG | ChatRAG Bench, MTRAG, QReCC | decontextualized query、previous citation anchoring、refusal calibration を評価する |
| 長大文書QA | MMLongBench-Doc, LongBench 系 | 500P超PDF、章節 retrieval、context budget、long-context regression を評価する |
| conflict / claim | typed claim extraction, NLI, value mismatch judge | 金額・日付・期限・scope 違いによる false conflict / false refusal を抑える |
| LLM評価 | G-Eval, LLM-as-a-judge | 人手評価を補助する。ただし本番ゲートは自動評価だけに依存しない |

外部ベンチマークは汎用性能の比較に使い、実運用の合否判定は rag-assist 内部の業務データに基づく closed benchmark を主とします。

------

## 9A.3 ベンチマークデータ構成

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `BenchmarkUseCase` / `BenchmarkCase` | ベンチマークユースケース / ベンチマークケース | 本章では 9.3 の定義を再利用し、ユースケースごとの期待回答・期待文書・期待ページなどを評価します。 |


ユースケース別の gold data:

```text
multiturn_chat:
- 会話ターン列
- 最終質問
- 期待される独立 query
- 必要な会話事実
- 不要になった条件

design_drawing_qa:
- 図面番号、図面名、改訂、尺度、sheet、layer、bbox
- 期待 citation
- OCR 文字列の許容ゆれ

internal_qa:
- 期待回答
- 期待根拠文書
- 権限違い時の回答不能期待
- 問い合わせ化の期待

long_pdf_qa:
- 期待ページ
- 期待章節
- 期待 chunk / parent chunk
- 表・図の参照要否

async_agent_task:
- 入力ファイルセット
- 使用 skill / agent profile
- 期待成果物
- diff / report の評価基準
```

------

## 9A.4 ベンチマークパイプライン

### 型定義: `BenchmarkPipeline`（ベンチマークパイプライン）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `BenchmarkPipeline` | ベンチマークパイプライン | データ準備から検索・回答・比較・成果物出力までの評価工程。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `pipelineId` | パイプラインID | 必須 | `string` | パイプラインIDを一意に識別するためのIDです。 |
| `suiteId` | スイートID | 必須 | `string` | スイートIDを一意に識別するためのIDです。 |
| `stages` | 工程一覧 | 必須 | `BenchmarkStage[]` | このデータで管理する「工程一覧」です。 |
| `baselineConfig` | 基準構成 | 必須 | `BenchmarkTargetConfig` | 基準構成として実行条件をまとめます。 |
| `candidateConfig` | 候補構成 | 必須 | `BenchmarkTargetConfig` | 候補構成として実行条件をまとめます。 |
| `promotionGate` | 本番反映ゲート | 必須 | `PromotionGate` | このデータで管理する「本番反映ゲート」です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |


### 型定義: `BenchmarkStage`（ベンチマーク工程）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `BenchmarkStage` | ベンチマーク工程 | ベンチマークパイプライン内の個別評価ステップ。 |

| 英名（値） | 日本語名 | 内容 |
|---|---|---|
| `prepare_dataset` | データセット準備 | 評価用データを準備する工程。 |
| `permission_fixture` | 権限条件準備 | 評価用の権限条件を用意する工程。 |
| `ingest_or_reindex` | 取り込み/再インデックス | 評価対象資料を取り込みまたは再構築する工程。 |
| `retrieval_eval` | 検索評価 | 検索結果の再現率などを評価する工程。 |
| `rerank_eval` | 再ランキング評価 | 再ランキングの品質を評価する工程。 |
| `answer_eval` | 回答評価 | 回答内容を評価する工程。 |
| `answerability_gate_eval` | 回答可否評価 | 回答可否判定を評価する工程。 |
| `support_verification_eval` | 支持検証評価 | 回答支持検証を評価する工程。 |
| `answer_repair_eval` | 回答修復評価 | 回答修復の成否を評価する工程。 |
| `computed_fact_eval` | 計算済み事実評価 | 計算回答を評価する工程。 |
| `claim_conflict_eval` | 主張矛盾評価 | 矛盾検出を評価する工程。 |
| `context_selection_eval` | 文脈選択評価 | LLMに渡す根拠選択を評価する工程。 |
| `citation_eval` | 引用評価 | 引用の正しさを評価する工程。 |
| `multiturn_eval` | マルチターン評価 | 会話継続時の回答品質を評価する工程。 |
| `drawing_metadata_eval` | 図面メタデータ評価 | 図面情報抽出と利用を評価する工程。 |
| `long_context_eval` | 長文脈評価 | 長大PDFや長文脈への対応を評価する工程。 |
| `async_agent_eval` | 非同期エージェント評価 | 非同期エージェント実行を評価する工程。 |
| `cost_latency_eval` | コスト・遅延評価 | 費用と応答時間を評価する工程。 |
| `regression_compare` | 回帰比較 | 前回や基準構成との差分を比較する工程。 |
| `artifact_export` | 成果物出力 | 評価結果を成果物として出力する工程。 |


### 型定義: `BenchmarkTargetConfig`（ベンチマーク対象設定）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `BenchmarkTargetConfig` | ベンチマーク対象設定 | モデル、検索器、chunker、promptなど、評価する構成。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `modelId` | モデルID | 必須 | `string` | モデルIDを一意に識別するためのIDです。 |
| `embeddingModelId` | EmbeddingモデルID | 任意 | `string` | EmbeddingモデルIDを一意に識別するためのIDです。 |
| `retrieverVersion` | retrieverバージョン | 必須 | `string` | 利用したretrieverバージョンを記録し、再実行や差分確認に使います。 |
| `rerankerVersion` | 再ランキング器バージョン | 任意 | `string` | 利用した再ランキング器バージョンを記録し、再実行や差分確認に使います。 |
| `chunkerVersion` | チャンク化バージョン | 任意 | `string` | 利用したチャンク化バージョンを記録し、再実行や差分確認に使います。 |
| `promptVersion` | プロンプトバージョン | 必須 | `string` | 利用したプロンプトバージョンを記録し、再実行や差分確認に使います。 |
| `contextCompressionVersion` | 文脈圧縮バージョン | 任意 | `string` | 利用した文脈圧縮バージョンを記録し、再実行や差分確認に使います。 |
| `indexVersion` | インデックスバージョン | 任意 | `string` | 利用したインデックスバージョンを記録し、再実行や差分確認に使います。 |
| `searchTermMappingVersion` | 検索語対応づけバージョン | 任意 | `string` | 利用した検索語対応づけバージョンを記録し、再実行や差分確認に使います。 |


### 型定義: `PromotionGate`（本番反映ゲート）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `PromotionGate` | 本番反映ゲート | 本番反映を許可するための最低品質、最大遅延、最大コストなどの基準。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `minRecallAtK` | 最小Recall@K | 任意 | `number` | 最小Recall@Kを数値で管理します。 |
| `minCitationPrecision` | 最小引用精度 | 任意 | `number` | 最小引用精度を数値で管理します。 |
| `minFaithfulness` | 最小忠実性 | 任意 | `number` | 最小忠実性を数値で管理します。 |
| `maxAnswerUnavailableFalseNegativeRate` | 最大回答不能見逃し率 | 任意 | `number` | 最大回答不能見逃し率を数値で管理します。 |
| `maxUnsupportedSentenceRate` | 最大非支持文率 | 任意 | `number` | 最大非支持文率を数値で管理します。 |
| `maxCitationUnsupportedRate` | 最大非支持引用率 | 任意 | `number` | 最大非支持引用率を数値で管理します。 |
| `maxFalseRefusalRate` | 最大過剰拒否率 | 任意 | `number` | 最大過剰拒否率を数値で管理します。 |
| `maxLatencyP95Ms` | 最大P95遅延 | 任意 | `number` | 最大P95遅延を数値で管理します。 |
| `maxCostPerCase` | 最大ケース単価 | 任意 | `number` | 最大ケース単価を数値で管理します。 |
| `requireNoCriticalRegression` | 重大劣化なし必須 | 必須 | `boolean` | 重大劣化なし必須を有効にするか、条件を満たすかを示します。 |


実行フロー:

```text
1. benchmark suite と useCase を選ぶ。
2. 対象フォルダ / 文書への readOnly 権限を確認する。
3. permission fixture を作り、権限あり / なしのケースを分ける。
4. baseline config と candidate config を確定する。
5. 必要に応じて ingest / reindex を行う。
6. retrieval_eval で recall@k、MRR、nDCG を測る。
7. rerank_eval で rerank 前後の順位改善を測る。
8. answer_eval で正答性、根拠性、回答不能判断を測る。
9. answerability_gate_eval で RequiredFact、primary fact、PARTIAL 継続条件、false refusal / false answer を測る。
10. support_verification_eval で unsupported sentence、contradiction、supported-only repair 成功率を測る。
11. computed_fact_eval で日付・期限・金額・閾値条件の計算妥当性を測る。
12. claim_conflict_eval で typed claim、value mismatch、scope-different no-conflict を測る。
13. context_selection_eval で minScore filter、high-confidence early stop、memory grounding を測る。
14. citation_eval で citation precision / recall、ページ一致、usedSpans 一致を測る。
15. multiturn_eval で会話圧縮、decontextualized query、previous citation anchoring、refusal filtering、文脈追従を測る。
16. drawing_metadata_eval で図面番号、改訂、尺度、layer、bbox 抽出を測る。
17. long_context_eval で 500P超PDFの章節検索、親子chunk、長文要約を測る。
18. async_agent_eval で実行成功率、成果物品質、writeback承認フローを測る。
19. cost_latency_eval で p50 / p95 latency、token、cost を測る。
20. regression_compare で baseline からの改善・劣化を出す。
21. promotionGate を満たす場合のみ本番反映可能にする。
22. 成果物、失敗ケース、trace、設定差分を artifact として保存する。
```

------



benchmark 用回答ポリシー:

### 型定義: `BenchmarkAnswerPolicy`（ベンチマーク回答ポリシー）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `BenchmarkAnswerPolicy` | ベンチマーク回答ポリシー | 評価時だけ使う短答、資料外禁止、固定拒否文などの回答ルール。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `answerStyle` | 回答スタイル | 必須 | `"benchmark_grounded_short"` | このデータで管理する「回答スタイル」です。 |
| `forbidExternalKnowledge` | 外部知識禁止 | 必須 | `true` | 外部知識禁止を有効にするか、条件を満たすかを示します。 |
| `forbidConversationHistoryOnlyAnswer` | 会話履歴だけの回答禁止 | 必須 | `true` | 会話履歴だけの回答禁止を有効にするか、条件を満たすかを示します。 |
| `requireReferenceLikeShortAnswer` | 基準回答風短答必須 | 必須 | `boolean` | 基準回答風短答必須を有効にするか、条件を満たすかを示します。 |
| `fixedRefusalMessage` | 固定拒否文 | 任意 | `string` | 固定拒否文として表示または処理する文字列です。 |
| `switchBy` | 切替条件 | 必須 | `"benchmark_metadata"` | 切替条件を示します。 |
| `forbidDatasetRowIdBranching` | データセット行ID分岐禁止 | 必須 | `true` | データセット行ID分岐禁止を有効にするか、条件を満たすかを示します。 |


```text
- benchmark corpus / runner 経路では通常 UI 向けの丁寧な補足を抑制する。
- reference answer 型の短答を優先する。
- 資料外補足、会話履歴だけに基づく補足、一般論の追加を禁止する。
- unanswerable の refusal 文言を固定し、false refusal / false answer を比較しやすくする。
- dataset 固有 row id、case id、個別ファイル名に hardcode した分岐は禁止する。
```

------

## 9A.5 評価指標

| 評価対象 | 指標 |
|---|---|
| retrieval | recall@k, precision@k, MRR, nDCG, hit rate |
| rerank | nDCG@k, MRR改善率, gold evidence順位 |
| answer | exact match, F1, semantic similarity, LLM judge score, human review score |
| groundedness | faithfulness, unsupported claim rate, citation coverage |
| citation | citation precision, citation recall, page accuracy, quote accuracy |
| answer unavailable | false positive, false negative, unavailable reason accuracy |
| multiturn | query rewrite accuracy, context carryover accuracy, stale context rejection |
| compression | compression ratio, information retention, answer delta |
| drawing | title block accuracy, layer recall, bbox accuracy, OCR accuracy, metadata completeness |
| long PDF | section hit rate, page hit rate, table/figure reference accuracy, latency |
| async agent | task success rate, artifact pass rate, diff correctness, cancellation success, writeback safety |
| operation | latency p50/p95, error rate, cost per case, token usage |

------



回答生成詳細の追加指標:

| 指標 | 内容 |
|---|---|
| primary fact support rate | primary fact が正しく支持されている割合 |
| false refusal rate | 本来回答可能な質問を answer_unavailable にした割合 |
| false answer rate | 根拠不足なのに回答した割合 |
| unsupported sentence rate | 回答文のうち evidence / computedFacts に支持されない文の割合 |
| repair success rate | supported-only repair 後に支持検証を通過した割合 |
| usedSpan accuracy | 回答値と source span の一致率 |
| computedFact accuracy | 日付・金額・閾値計算の正確性 |
| claim conflict accuracy | scope を考慮した conflict / no-conflict 判定の正確性 |
| decontextualized query success | follow-up 質問が検索可能な独立 query になった割合 |
| memory grounding success | memory hit が source chunk / page range に正しく展開された割合 |
| final context contamination rate | minScore 未満、権限外、品質外、低信頼 block が context に混入した割合 |

------

## 9A.6 ベンチマーク成果物

```text
- run summary
- baseline / candidate config diff
- case-level result
- failure analysis
- retrieval result list
- rerank score
- generated answer
- citation list
- answer unavailable reason
- debug trace link
- cost / latency
- promotion gate 判定
```

失敗ケースから次へつなげます。

```text
検索漏れ:
検索改善候補、chunker改善、metadata filter改善へ。

根拠なし回答:
prompt改善、groundedness check改善、answer_unavailable閾値調整へ。

図面metadata失敗:
抽出器、OCR、title block parser、layer parser改善へ。

マルチターン失敗:
query rewrite、会話圧縮、ConversationState改善へ。

長大PDF失敗:
章節解析、parent-child chunk、要約index、rerank改善へ。

非同期エージェント失敗:
skill改善、agent profile改善、workspace mount、実行器設定改善へ。
```

------

## 9A.7 ベンチマーク受け入れ条件

```text
AC-BENCH-USECASE-001:
benchmark case は useCase tag を持つ。

AC-BENCH-USECASE-002:
マルチターン benchmark では、会話履歴、期待 query rewrite、期待回答を評価できる。

AC-BENCH-USECASE-003:
図面 benchmark では、図面 metadata、OCR、title block、layer、bbox を評価できる。

AC-BENCH-USECASE-004:
500P超PDF benchmark では、期待ページ、期待章節、期待 citation を評価できる。

AC-BENCH-USECASE-005:
社内相談QA benchmark では、権限あり / なし、回答不能、問い合わせ導線を評価できる。

AC-BENCH-USECASE-006:
非同期エージェント benchmark では、raw file mount、skill / agent profile、成果物を評価できる。

AC-BENCH-PIPE-001:
benchmark run は baseline config と candidate config の差分を保存する。

AC-BENCH-PIPE-002:
retrieval、answer、citation、latency、cost を case 単位で保存する。

AC-BENCH-PIPE-003:
promotionGate を満たさない run は本番反映できない。

AC-BENCH-PIPE-004:
失敗ケースから検索改善、chunker改善、prompt改善、skill改善に遷移できる。
```

------


# 9B. ナレッジ品質・文書解析ベンチマーク

## 9B.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Quality benchmark | 品質ベンチマーク | 未検証、期限切れ、低OCR、表抽出失敗など品質条件を含めて評価するベンチマーク。 |
| Parse benchmark | 解析ベンチマーク | PDF、OCR、表、図、図面metadataの抽出品質を評価するベンチマーク。 |

### データ
この章では、データ構造ではなく方針・ルールを中心に整理します。


### 守るべきルール
- 品質ゲートを満たさない結果は本番反映しない。
- expiredやsuperseded文書を現在の根拠に使わないことを評価する。
- OCR低信頼や表抽出低信頼の誤回答率を測定する。

### 実行すべき処理
1. 品質状態別、文書種別別、解析種別別のケースを用意する。
2. 回答可否、citation、表・図・OCR根拠の正しさを測定する。
3. 失敗を文書更新、検証依頼、再解析、チャンク化見直しへ変換する。

### UI
- 品質ベンチマーク画面に失敗ケース、品質起因分類、改善候補を表示する。
- 管理ダッシュボードから品質ベンチマーク結果へ遷移できる。

------

## 9B.1 目的

ナレッジ品質・文書解析ベンチマークは、古い文書、未検証文書、OCR低信頼文書、表抽出失敗文書などを誤って根拠にしないことを確認する品質ゲートです。

```text
目的:
- active だが RAG には使ってはいけない文書を除外できるか
- 品質警告を正しく表示できるか
- answer_unavailable を適切に返せるか
- PDF / 表 / 図 / OCR / 図面の解析品質が回答品質に影響するケースを検出できるか
```

## 9B.2 ベンチマークケース構成

```text
- verified / current 文書で回答できるケース
- unverified 文書しかないケース
- stale 文書しかないケース
- expired 文書しかないケース
- superseded 文書しかないケース
- 新旧文書が矛盾するケース
- スキャンPDFから回答するケース
- OCR信頼度が低いページを含むケース
- 複雑PDFの読み順が回答に影響するケース
- 表から数値・金額・日付を回答するケース
- 画像・図・スクリーンショットから回答するケース
- citation が正しいページ、表、図を指すか確認するケース
```

## 9B.3 評価指標

| 指標 | 内容 |
|---|---|
| quality policy adherence | expired / superseded / rejected を根拠にしないか |
| warning accuracy | stale / unverified 利用時に適切に警告するか |
| answer_unavailable accuracy | 根拠品質が不足する場合に推測回答しないか |
| OCR robustness | OCR低信頼箇所を断定しないか |
| table answer correctness | 表の列名・行名・単位を踏まえて回答できるか |
| figure citation accuracy | 図・画像に対する citation が正しいか |
| parse regression | parserVersion 変更前後で抽出結果が悪化していないか |
| false exclusion rate | 本来使える文書を過剰に除外していないか |
| false inclusion rate | 使うべきでない文書を根拠にしていないか |

## 9B.4 ベンチマーク受け入れ条件

```text
AC-KQ-BENCH-001:
ベンチマークケースには、verified文書、unverified文書、stale文書、expired文書、superseded文書を含められる。

AC-KQ-BENCH-002:
expired文書を現在の根拠として使わないことをテストできる。

AC-KQ-BENCH-003:
superseded文書を最新版として使わないことをテストできる。

AC-KQ-BENCH-004:
未検証文書しかない場合に、ポリシーどおり警告付き回答または answer_unavailable になることをテストできる。

AC-KQ-BENCH-005:
スキャンPDFからの回答精度を評価できる。

AC-KQ-BENCH-006:
複雑PDFの読み順が回答に影響するケースを評価できる。

AC-KQ-BENCH-007:
表から数値を回答するケースを評価できる。

AC-KQ-BENCH-008:
画像・図・スクリーンショットから回答するケースを評価できる。

AC-KQ-BENCH-009:
citation が正しいページ、表、図を指しているか評価できる。

AC-KQ-BENCH-010:
品質ポリシー変更前後で、answer_unavailable率、誤回答率、citation正確性を比較できる。

AC-KQ-BENCH-011:
OCR信頼度の低い文書を根拠にした誤回答率を測定できる。

AC-KQ-BENCH-012:
表抽出信頼度の低い文書を根拠にした誤回答率を測定できる。

AC-KQ-BENCH-013:
品質ゲートを満たさないベンチマーク結果は、本番反映できない。

AC-KQ-BENCH-014:
品質起因の失敗ケースを、文書更新、検証依頼、再解析、チャンク化見直しの改善タスクに変換できる。
```

------


# 9C. ベンチマーク運用・外部データセット・runner 実行基盤

## 9C.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| CodeBuild runner | CodeBuildランナー | ベンチマークなどをAWS CodeBuildで実行する仕組み。 |
| Secrets Manager | シークレット管理 | パスワードやトークンを安全に保管するAWSサービス。ログに秘密情報を出さない。 |
| Corpus seed | 評価コーパス投入 | benchmark suiteごとに評価用文書を投入・隔離する処理。 |
| Metadata budget | メタデータ容量制約 | ベクトル検索基盤のfilterable metadata容量制限を超えないようにする制約。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| BenchmarkRunnerAuth | ベンチマーク実行認証 | service user、secret、token取得方法を管理する。 |
| BenchmarkDatasetPrepareRun | ベンチマークデータ準備実行 | 外部datasetの取得、変換、skip、失敗理由を管理する。 |

### 守るべきルール
- benchmark runnerの認証情報をログに出さない。
- service userの権限はbenchmark実行に必要な範囲に限定する。
- 評価corpusは通常チャット検索対象から隔離する。
- 外部dataset取得失敗や抽出不能PDFはskip理由を明示する。

### 実行すべき処理
1. Secrets Managerから認証情報を取得する。
2. suiteごとに古いcorpusを削除し、新しいcorpusをseedする。
3. 外部datasetを取得・変換し、抽出不能ケースを記録する。
4. benchmark runをAPI経由で起動し、完了までpollingする。

### UI
- 管理画面またはGitHub Actions起点でbenchmark runを起動できる。
- run詳細にcorpus seed状態、skip件数、外部dataset準備結果を表示する。

------

## 9C.1 目的

この章は、管理画面から見えるベンチマーク機能ではなく、CI / Ops / CodeBuild runner がベンチマークを安全かつ再現可能に実行するための運用仕様です。

```text
ベンチマーク画面:
品質判断と結果確認のためのプロダクト機能。

ベンチマーク runner:
corpus 準備、dataset 変換、API token 解決、run 作成、結果取得、成果物保存を行う運用処理。
```

## 9C.2 benchmark runner 認証

本番 API に対して benchmark run を作成する runner は、通常ユーザーではなく service user として扱います。

### 型定義: `BenchmarkRunnerAuth`（ベンチマーク実行認証）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `BenchmarkRunnerAuth` | ベンチマーク実行認証 | CI/Opsからベンチマークを実行するためのサービスユーザーと秘密情報。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `runnerId` | ランナーID | 必須 | `string` | ランナーIDを一意に識別するためのIDです。 |
| `serviceUserId` | サービスユーザーID | 必須 | `string` | サービスユーザーIDを一意に識別するためのIDです。 |
| `roleName` | ロール名称 | 必須 | `"BENCHMARK_RUNNER"` | このデータで管理する「ロール名称」です。 |
| `secretId` | シークレットID | 必須 | `string` | シークレットIDを一意に識別するためのIDです。 |
| `tokenExpiresAt` | トークン有効期限 | 任意 | `string` | トークン有効期限を記録します。 |
| `resolvedAt` | 解決日時 | 任意 | `string` | 解決日時を記録します。 |


方針です。

```text
- runner は Secrets Manager 等に保存された secret から API 認証情報を解決する。
- secret 名の例は BENCHMARK_OPERATOR_AUTH_SECRET_ID とする。
- token / password / refresh token はログ、artifact、debug trace に出さない。
- secret 解決に失敗した場合、benchmark は継続しない。
- service user は benchmark 用 ACL に限定し、通常ユーザーの文書・会話へ横断アクセスできない。
```

## 9C.3 benchmark corpus seed lifecycle

benchmark suite ごとに corpus を固定し、古い corpus の混入を防ぎます。

```text
1. suite を選択する。
2. runner 専用の benchmark scope / folder を作成または初期化する。
3. 前回の seed corpus を削除または archive する。
4. suite 定義に従って corpus をアップロードする。
5. ingest run 完了を待つ。
6. active chunk 数、citation 可能性、品質ゲート結果を確認する。
7. 期待 corpus と実際 corpus が一致しない場合は fatal とする。
8. 抽出不能文書は skipped_unextractable として記録する。
9. benchmark run を作成する。
10. 成果物に seed manifest、skip manifest、latency、metrics を保存する。
```

skip 条件です。

```text
skipped_unextractable:
抽出不能 PDF、暗号化 PDF、外部取得失敗、OCR 不可能、0chunk など。

skipped_network_unavailable:
外部 dataset 取得に必要なネットワークに接続できない。

skipped_license_or_terms:
dataset の利用条件を満たせない。
```

fatal 条件です。

```text
- expected corpus が存在しない。
- seed 後に active chunk が 0 件。
- 古い corpus が残ったまま run される。
- service user の認証 token を解決できない。
- benchmark 用 ACL が通常チャット検索対象に混入する。
```

## 9C.4 外部 benchmark dataset 取得・変換

外部 dataset を利用する場合、取得・変換・失敗条件を artifact として残します。

対象例です。

```text
- MMLongBench-Doc
- MTRAG
- ChatRAG Bench
- Allganize 日本語公開 dataset
- 国土交通省・自治体公開 PDF
- NDL WARP fallback
- Hugging Face 上の公開 QA / retrieval dataset
```

変換処理です。

```text
1. dataset manifest を読み込む。
2. 外部 URL からファイルを取得する。
3. ライセンス、再配布可否、利用条件を記録する。
4. PDF / HTML / JSON / CSV などを benchmark corpus 形式へ変換する。
5. question、expected answer、expected citation、expected document、tags を生成する。
6. 取得失敗、変換失敗、抽出不能を skip manifest に保存する。
7. datasetVersion と conversionVersion を run に紐づける。
```

### 型定義: `BenchmarkDatasetPrepareRun`（ベンチマークデータ準備実行）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `BenchmarkDatasetPrepareRun` | ベンチマークデータ準備実行 | 外部データセットの取得、変換、スキップ、失敗を管理する処理。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `prepareRunId` | 準備実行ID | 必須 | `string` | 準備実行IDを一意に識別するためのIDです。 |
| `datasetName` | データセット名 | 必須 | `string` | このデータで管理する「データセット名」です。 |
| `datasetVersion` | データセットバージョン | 任意 | `string` | 利用したデータセットバージョンを記録し、再実行や差分確認に使います。 |
| `conversionVersion` | conversionバージョン | 必須 | `string` | 利用したconversionバージョンを記録し、再実行や差分確認に使います。 |
| `status` | 状態 | 必須 | `"queued" / "running" / "completed" / "failed"` | 対象の現在の状態を示します。 |
| `fetchedFiles` | 取得ファイル一覧 | 必須 | `number` | 取得ファイル一覧を数値で管理します。 |
| `convertedCases` | 変換ケース数 | 必須 | `number` | 変換ケース数を数値で管理します。 |
| `skippedCases` | スキップケース数 | 必須 | `number` | スキップケース数を数値で管理します。 |
| `skipReasons` | スキップ理由 | 必須 | `Record<string, number>` | スキップ理由を数値で管理します。 |
| `artifacts` | 成果物一覧 | 必須 | `string[]` | このデータで管理する「成果物一覧」です。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |


## 9C.5 S3 Vectors metadata budget policy

vector index の filterable metadata は容量制限を持つ場合があるため、検索 filter 用 metadata と診断 artifact を分離します。
S3 Vectors を利用する場合は、filterable metadata の 2048 bytes budget を超えないように compact 化します。

```text
filterable metadata に入れる:
- tenantId
- documentId
- folderId
- chunkId
- indexVersion
- pageNumber
- chunkType
- lifecycleStatus
- ragEligibility
- verificationStatus
- freshnessStatus
- supersessionStatus
- parserVersion の短縮ID
- benchmarkSuiteId / benchmarkRunId など必要最小限

filterable metadata に入れない:
- 長いタイトル
- 長い canonicalPath
- chunk本文
- OCR全文
- 図面 layer の長大配列
- table cells の詳細
- debug trace
- extraction artifact 全体
```

長い値は `DocumentMetadataArtifact`、`ParsedDocument`、`DebugTrace` などに保存し、vector metadata には参照 ID のみを持たせます。

## 9C.6 GitHub Actions からの benchmark run 起動

管理画面以外に、GitHub Actions の手動 workflow から benchmark run を起動できます。

```text
1. workflow_dispatch で suite、targetConfig、environment を指定する。
2. GitHub Actions が OIDC または secret により必要な実行権限を取得する。
3. runner 認証 secret を解決する。
4. POST /benchmark-runs を呼ぶ。
5. Step Functions + CodeBuild runner の既存経路で run を作成する。
6. run status を polling する。
7. timeout、failed、cancelled、completed を判定する。
8. 結果 summary と artifact link を GitHub Actions summary に出す。
```

制約です。

```text
- suite 選択を必須にする。
- production 環境では環境承認を必須にする。
- polling timeout を設定する。
- benchmark token や API response の機微情報は mask する。
```

## 9C.7 受け入れ条件

```text
AC-BENCH-OPS-001:
CodeBuild runner は service user と secret により API 認証情報を解決できる。

AC-BENCH-OPS-002:
runner 認証情報の解決に失敗した場合、benchmark run は開始されない。

AC-BENCH-OPS-003:
benchmark corpus は suite ごとに seed され、古い corpus が残ったまま測定されない。

AC-BENCH-OPS-004:
抽出不能 PDF や取得失敗 dataset は skipped_unextractable 等として記録される。

AC-BENCH-OPS-005:
benchmark 用 corpus は通常チャットの検索対象に混入しない。

AC-BENCH-OPS-006:
外部 dataset の取得、変換、skip 理由、version は artifact に保存される。

AC-BENCH-OPS-007:
vector metadata は metadata budget policy に従い、容量制限を超える長大値を filterable metadata に入れない。

AC-BENCH-OPS-008:
GitHub Actions から benchmark run を起動する場合、suite、timeout、environment、認証 secret を明示する。
```

------

# 10. 管理ダッシュボード

## 10.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Admin dashboard | 管理ダッシュボード | 全体状態を把握し、要対応へ遷移する入口。編集フォームではなく監視・導線の画面。 |
| Action card | 対応カード | 未対応問い合わせ、失敗取り込み、期限切れ文書など、クリックして対応へ進むカード。 |
| KPI | 重要指標 | 件数、コスト、失敗率、最新ベンチマーク結果などの集計値。 |

### データ
この章では、データ構造ではなく方針・ルールを中心に整理します。


### 守るべきルール
- 管理ダッシュボードに直接編集フォームを置かない。
- 表示カードはユーザーの権限に応じて変える。
- クリックできないKPIはActionCardと同じ見た目にしない。

### 実行すべき処理
1. 権限に応じて問い合わせ、取り込み、品質、ベンチマーク、コスト、監査のカードを集計する。
2. 各カードから該当詳細画面へ遷移する。
3. 要対応件数と最新状態を定期的に更新する。

### UI
- 上段に要対応件数、失敗/警告件数、今月コスト、最新ベンチマーク結果を表示する。
- 中段に未回答問い合わせ、失敗取り込み、品質要対応、コスト異常などを表示する。

------

## 10.1 目的

管理ダッシュボードは、全体状態を把握し、要対応へ遷移する入口です。

編集フォームは置きません。

------

## 10.2 画面要件

```text
管理ダッシュボード

上段:
- 要対応件数
- 失敗 / 警告件数
- 今月コスト
- 最新ベンチマーク結果

中段:
- 未回答問い合わせ
- 失敗した取り込み
- reindex cutover 待ち
- 確認待ちの検索改善候補
- コスト異常
- 高リスク権限変更
- 未検証文書
- 検証期限切れ文書
- 期限切れ文書
- OCR信頼度が低い文書
- 表抽出に失敗した文書
- 図解析に失敗した文書
- 解析要確認文書
- 文書オーナー未設定
- レビュー期限超過

下段:
- ナレッジ管理
- 問い合わせ対応
- 検索改善
- 評価・ベンチマーク
- ユーザー・グループ
- ロール・権限
- 利用状況・コスト
- 監査ログ
```

カードは原則クリック可能にします。
クリックできない KPI は見た目を分けます。

------

## 10.3 認可

管理ダッシュボードは、持っている権限に応じて見えるカードを変えます。

```text
問い合わせ担当:
問い合わせカードを表示

RAG管理者:
失敗取り込み、フォルダ、再インデックスを表示

ベンチマーク担当:
最新run、失敗runを表示

アクセス管理者:
ロール変更、監査ログを表示

コスト監査者:
利用状況、コストを表示
```

------

## 10.4 受け入れ条件

```text
AC-ADMIN-DASH-001:
管理ダッシュボードには編集フォームを置かない。

AC-ADMIN-DASH-002:
要対応カードから該当詳細画面へ遷移できる。

AC-ADMIN-DASH-003:
ユーザーの権限に応じて表示カードが変わる。

AC-ADMIN-DASH-004:
クリックできない KPI は ActionCard と同じ見た目にしない。

AC-ADMIN-DASH-005:
最新ベンチマーク、失敗取り込み、問い合わせ件数を確認できる。
```

------

# 11. ユーザー・グループ管理

## 11.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| User management | ユーザー管理 | ユーザーの状態、所属ロール、所属グループ、危険権限を管理する機能。 |
| Group management | グループ管理 | 部署、プロジェクト、チーム、管理者グループのメンバーと権限を管理する機能。 |
| Dangerous permission | 危険権限 | 管理者権限、公開権限、削除権限など、影響が大きい権限。 |

### データ
この章では、データ構造ではなく方針・ルールを中心に整理します。


### 守るべきルール
- ロール付与やグループメンバー変更を一覧行で即実行しない。
- グループメンバー変更では影響するフォルダ・文書を確認する。
- 内部folderPolicyグループは通常UIに表示しない。
- グループ階層に循環を作れない。

### 実行すべき処理
1. ユーザー一覧・詳細を表示し、状態、ロール、グループを確認する。
2. グループメンバー追加・削除・権限変更の影響を計算する。
3. 停止、削除、管理者権限付与は危険操作として監査する。

### UI
- ユーザー一覧に検索、状態、ロール、グループフィルタを表示する。
- ユーザー詳細に基本情報、所属、実効権限、閲覧可能フォルダ、監査履歴を表示する。
- グループ詳細にメンバー、管理フォルダ、共有フォルダ、子グループを表示する。

------

## 11.1 目的

ユーザー・グループ管理は、誰がどのグループに属し、どの資料にアクセスできるかを管理する機能です。

------

## 11.2 ユーザー一覧

```text
ユーザー
  ├─ 検索
  ├─ 状態フィルタ
  ├─ ロールフィルタ
  ├─ グループフィルタ
  └─ 一覧
```

一覧列:

```text
- ユーザー名
- email
- 状態
- 所属ロール
- 所属グループ
- 最終ログイン
- 危険権限バッジ
```

------

## 11.3 ユーザー詳細

```text
ユーザー詳細
  ├─ 基本情報
  ├─ 所属グループ
  ├─ 所属ロール
  ├─ 実効権限
  ├─ 閲覧可能フォルダ
  ├─ 監査履歴
  └─ 危険操作
      ├─ 停止
      ├─ 再開
      └─ 削除
```

------

## 11.4 グループ一覧

```text
グループ
  ├─ 部署
  ├─ プロジェクト
  ├─ チーム
  ├─ 管理者グループ
  └─ 内部グループ
```

`folderPolicy` 型の内部グループは、通常画面では非表示にします。

------

## 11.5 グループ詳細

```text
グループ詳細
  ├─ 基本情報
  ├─ メンバー
  ├─ メンバーごとの権限
  ├─ 管理しているフォルダ
  ├─ 共有されているフォルダ
  ├─ 子グループ
  └─ 監査履歴
```

------

## 11.6 認可

```text
user:read
user:create
user:update
user:suspend
user:delete

group:read
group:create
group:update
group:archive
group:membership:update
```

グループメンバー変更は危険操作です。

```text
- 追加されるユーザー
- 削除されるユーザー
- 権限が変わるユーザー
- 影響するフォルダ数
- 影響する文書数
```

を表示します。

------

## 11.7 受け入れ条件

```text
AC-USER-001:
ユーザー一覧からユーザー詳細へ遷移できる。

AC-USER-002:
ロール付与は一覧行で即実行しない。

AC-USER-003:
ロール変更時は差分と影響を表示する。

AC-GROUP-001:
グループには full / readOnly のメンバー権限を設定できる。

AC-GROUP-002:
グループメンバー変更により、グループ管理フォルダの実効権限が変わる。

AC-GROUP-003:
グループを削除・archive する前に、管理フォルダの移譲先を指定する。

AC-GROUP-004:
グループ階層に循環を作れない。

AC-GROUP-005:
内部 folderPolicy グループは通常 UI に表示しない。
```

------

# 12. ロール・権限管理

## 12.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Permission | 権限 | 機能や対象に対して実行を許可する最小単位。 |
| Role | ロール | 複数の機能権限をまとめた権限セット。 |
| System role | システムロール | 初期提供され、削除や大幅変更を制限するロール。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| Role | ロール | ロールID、名前、表示名、説明、権限一覧、systemRoleを管理する。 |

### 守るべきルール
- ロールはアプリ機能を使えるかを決め、文書閲覧権限とは分ける。
- 強権限ロールの付与・剥奪は危険操作として理由入力を必須にする。
- ロール変更時は変更前後の差分と影響を表示する。

### 実行すべき処理
1. ロール定義を作成・更新する。
2. ユーザーへのロール付与・剥奪時に影響を計算する。
3. 変更理由と変更前後を監査ログに保存する。

### UI
- ロール一覧、ロール詳細、権限一覧、割当ユーザーを表示する。
- 変更ダイアログに差分、影響、理由入力を表示する。

------

## 12.1 目的

ロールは、アプリ機能を使えるかどうかを決めます。

フォルダや文書に対するアクセスとは別です。

```text
ロール:
機能を使えるか

フォルダ権限:
対象に対して何ができるか
```

------

## 12.2 ロールデータ

### 型定義: `Role`（ロール）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `Role` | ロール | アプリ上でどの機能を使えるかを決める権限セット。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `roleId` | ロールID | 必須 | `string` | ロールIDを一意に識別するためのIDです。 |
| `name` | 名称 | 必須 | `string` | このデータで管理する「名称」です。 |
| `displayName` | 表示名 | 必須 | `string` | このデータで管理する「表示名」です。 |
| `description` | 説明 | 必須 | `string` | このデータで管理する「説明」です。 |
| `permissions` | 権限一覧 | 必須 | `Permission[]` | 操作や対象に必要な権限一覧を示します。 |
| `systemRole` | システムロール | 必須 | `boolean` | システムロールを有効にするか、条件を満たすかを示します。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


------

## 12.3 ロール変更

ロール付与・剥奪は危険操作です。

```text
変更前:
CHAT_USER

変更後:
CHAT_USER
RAG_ADMIN

影響:
- フォルダ作成が可能になります
- 文書アップロードが可能になります
- 再インデックスが可能になります
```

理由入力を必須にします。

------

## 12.4 受け入れ条件

```text
AC-ROLE-001:
ロール付与には role:assign が必要。

AC-ROLE-002:
ロール剥奪には role:assign が必要。

AC-ROLE-003:
ロール変更時は変更前後の差分を表示する。

AC-ROLE-004:
強権限ロール付与時は理由入力を必須にする。

AC-ROLE-005:
ロール変更は監査ログに残る。
```

------

# 13. 利用状況・コスト

## 13.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Usage | 利用状況 | チャット、RAG、embedding、benchmark、エージェントなどの利用量。 |
| Cost | コスト | モデル利用、embedding、ストレージ、benchmark実行などの費用。 |
| Cost anomaly | コスト異常 | 通常より高い利用量や費用が発生している状態。 |

### データ
この章では、データ構造ではなく方針・ルールを中心に整理します。


### 守るべきルール
- ユーザー別利用量やコストは個人情報に関わるため権限を分ける。
- コストexportには専用権限を必要にする。
- 異常利用は管理ダッシュボードへ表示する。

### 実行すべき処理
1. 機能別、モデル別、ユーザー別、グループ別の利用量を集計する。
2. 月次コスト、前月比、benchmarkコスト、異常利用を計算する。
3. 権限に応じて集計単位を制御して表示する。

### UI
- 利用状況・コスト画面で今月コスト、前月比、モデル別コスト、機能別コストを表示する。
- ユーザー別利用量は権限を持つ管理者だけに表示する。

------

## 13.1 目的

利用状況・コストは、RAG 利用量、モデル利用量、embedding、benchmark 実行コストを確認する機能です。

------

## 13.2 画面要件

```text
利用状況・コスト
  ├─ 今月コスト
  ├─ 前月比
  ├─ ユーザー別利用量
  ├─ グループ別利用量
  ├─ モデル別コスト
  ├─ 機能別コスト
  ├─ benchmark コスト
  └─ 異常利用
```

------

## 13.3 認可

```text
usage:read
cost:read
cost:export
```

個人情報に関わるため、細かく分けます。

```text
usage:read:aggregate
usage:read:user
cost:read:aggregate
cost:read:user
```

------

## 13.4 受け入れ条件

```text
AC-USAGE-001:
集計利用量を確認できる。

AC-USAGE-002:
ユーザー別利用量を見るには user-level usage 権限が必要。

AC-COST-001:
月次コストを確認できる。

AC-COST-002:
高コスト run や高コストユーザーを確認できる。

AC-COST-003:
コストデータの export には cost:export が必要。
```

------

# 14. 監査ログ

## 14.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| AuditLog | 監査ログ | 誰が、いつ、何を、どの対象に対して行ったかの記録。 |
| Actor | 実行者 | 操作を行ったユーザー、service user、workerなど。 |
| Target | 対象 | 操作対象となったフォルダ、文書、ユーザー、run、チケットなど。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| AuditLogEntry | 監査ログ項目 | 実行者、操作、対象、変更前後、理由、requestId、作成日時を管理する。 |

### 守るべきルール
- 危険操作、権限変更、公開、削除、cutover、writebackは監査ログ必須。
- 理由入力が必要な操作ではreasonを保存する。
- 通常ユーザーには監査ログを見せない。
- 監査ログexportには専用権限を必要にする。

### 実行すべき処理
1. 操作前後の差分、対象、影響件数、理由、requestIdを記録する。
2. 監査ログ検索・フィルタ・exportを提供する。
3. 権限外情報を含むログ表示は無害化する。

### UI
- 監査ログ画面に日時、実行者、操作、対象、理由、変更前後を表示する。
- 検索、期間フィルタ、対象種別フィルタ、exportを提供する。

------

## 14.1 目的

監査ログは、誰が、いつ、何を、どの対象に対して行ったかを追跡する機能です。

------

## 14.2 監査ログデータ

### 型定義: `AuditLogEntry`（監査ログ項目）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `AuditLogEntry` | 監査ログ項目 | 誰が、いつ、何を、どの対象に対して行ったかを記録する項目。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `auditLogId` | 監査ログID | 必須 | `string` | 監査ログIDを一意に識別するためのIDです。 |
| `actorUserId` | 実行者ユーザーID | 必須 | `string` | 実行者ユーザーIDを一意に識別するためのIDです。 |
| `action` | 操作 | 必須 | `string` | このデータで管理する「操作」です。 |
| `targetType` | 対象種別 | 必須 | `\| "folder" \| "document" \| "chatSession" \| "chatOrchestrationRun" \| "chatToolInvocation" \| "asyncAgentRun" \| "agentArtifact" \| "skill" \| "agentProfile" \| "supportTicket" \| "searchTermMapping" \| "be ...` | このデータで管理する「対象種別」です。 |
| `targetId` | 対象ID | 必須 | `string` | 対象IDを一意に識別するためのIDです。 |
| `before` | 変更前 | 任意 | `unknown` | このデータで管理する「変更前」です。 |
| `after` | 変更後 | 任意 | `unknown` | このデータで管理する「変更後」です。 |
| `affectedUserCount` | 影響ユーザー数 | 任意 | `number` | 影響ユーザー数を数値で管理します。 |
| `affectedDocumentCount` | 影響文書数 | 任意 | `number` | 影響文書数を数値で管理します。 |
| `reason` | 理由 | 任意 | `string` | 理由を説明し、担当者確認や監査に使います。 |
| `requestId` | リクエストID | 必須 | `string` | リクエストIDを一意に識別するためのIDです。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |


------

## 14.3 必須監査対象

```text
フォルダ:
- 作成
- 名前変更
- 移動
- archive
- 管理者変更
- 共有設定作成
- 共有設定変更
- 共有設定削除

文書:
- アップロード
- 取り込み成功 / 失敗
- 削除
- 移動
- ファイル名変更
- 再インデックス
- cutover
- rollback

チャット:
- 問い合わせ化
- 低評価
- 一時添付の永続化
- ChatOrchestrationRun 作成 / 失敗
- ChatToolInvocation 実行 / 承認 / 失敗

非同期エージェント:
- AsyncAgentRun 作成
- 実行器 / モデル選択
- workspace mount
- cancel
- 成果物作成
- 成果物DL
- writeback
- run 削除 / archive

skills / agent profile:
- 作成
- 更新
- archive
- 共有設定作成
- 共有設定変更
- 共有設定削除
- AI生成 draft の保存

個人設定:
- モデル既定値変更
- 非同期エージェント既定値変更
- 通知 / privacy 設定変更

アカウント・認証:
- アカウント作成
- メール確認
- ログイン成功 / 失敗
- パスワード変更
- パスワード再設定要求
- MFA 設定変更
- セッション失効
- アカウント削除申請 / 削除

検索改善:
- 候補作成
- 承認
- 差戻
- 検索に反映
- 停止

ベンチマーク:
- run 作成
- cancel
- 成果物DL
- 本番反映

ユーザー・グループ:
- ユーザー作成
- 停止
- 再開
- 削除
- グループ作成
- メンバー追加
- メンバー削除
- メンバー権限変更

ロール:
- 付与
- 剥奪
```

------

## 14.4 認可

```text
audit:read
audit:export
```

通常ユーザーには監査ログを見せません。

------

## 14.5 受け入れ条件

```text
AC-AUDIT-001:
危険操作は監査ログに記録される。

AC-AUDIT-002:
監査ログには actor、action、target、before、after、createdAt が含まれる。

AC-AUDIT-003:
理由入力が必要な操作では reason を保存する。

AC-AUDIT-004:
監査ログ export には audit:export が必要。

AC-AUDIT-005:
通常ユーザーは監査ログを閲覧できない。
```

------

# 14A. デバッグ・トレース・運用診断

## 14A.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Debug trace | デバッグトレース | 処理ステップ、入力要約、出力要約、件数、警告を安全に確認する記録。 |
| Replay | リプレイ | 過去の実行条件を再現して検証すること。 |
| Sanitization | 無害化 | 権限外情報、秘密情報、内部ポリシーを表示しないように加工すること。 |
| Display level | 表示レベル | 利用者向け、担当者向け、運用者向け、内部保守向けなどの表示範囲。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| DebugTargetType | デバッグ対象種別 | chat、rag、ingest、agent、tool、benchmarkなどの対象種別を表す。 |
| DebugTrace | デバッグトレース | 対象run、表示レベル、イベント、要約、エラーを管理する。 |
| DebugTraceEvent | デバッグトレースイベント | 各処理ステップの開始、終了、警告、失敗を管理する。 |
| AnswerGenerationDebugSummary | 回答生成デバッグ要約 | 回答可否、support判定、修復、used evidenceを安全に要約する。 |

### 守るべきルール
- debug権限は文書閲覧権限を拡張しない。
- raw chunk previewは対象フォルダreadOnly以上、replayは対象フォルダfullなど追加権限を必要にする。
- 権限外文書名、内部policy、LLM内部推論、秘密情報は表示しない。
- 利用者向け、担当者向け、運用者向け、内部保守向けで表示レベルを分ける。

### 実行すべき処理
1. chat、RAG、ingest、agent、tool、benchmarkのtraceを保存する。
2. 表示要求時に権限と表示レベルでsanitizeする。
3. exportやreplay時は危険操作として承認・監査する。

### UI
- デバッグ画面で対象run、処理ステップ、件数、警告、エラー、除外理由を表示する。
- 利用者には「なぜ回答できなかったか」の安全な要約だけを表示する。
- 運用者には権限範囲内でchunk previewや品質除外理由を表示する。

------

## 14A.1 目的

デバッグ機能は、取り込み失敗、チャンク品質、検索失敗、回答不能、チャット内オーケストレーション / チャット内ツール / 非同期エージェント実行失敗を、運用者が安全に調査するための機能です。

```text
デバッグ =
  実行 run の構造化 trace
  + 入出力概要
  + 件数 / latency / score
  + 警告 / エラー
  + 権限内で確認できる citation / chunk preview
```

デバッグ情報は、回答品質改善と障害対応のために使います。
権限外文書、内部 policy、不要な個人情報、LLM の内部推論は表示しません。

------

## 14A.2 デバッグ対象

### 型定義: `DebugTargetType`（デバッグ対象種別）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `DebugTargetType` | デバッグ対象種別 | 取り込み、RAG、チャット、ツール、ベンチマークなど、診断対象の種類。 |

| 英名（値） | 日本語名 | 内容 |
|---|---|---|
| `ingestRun` | 取り込み実行 | 文書取り込み処理の実行単位。 |
| `reindexRun` | 再インデックス実行 | 再インデックス処理の実行単位。 |
| `ragRun` | RAG実行 | RAG検索・回答生成の実行単位。 |
| `chatOrchestrationRun` | チャット内オーケストレーション実行 | チャット内で検索・ツール・回答生成を調整する実行単位。 |
| `chatToolInvocation` | チャット内ツール実行 | チャット内ツールの1回の実行記録。 |
| `asyncAgentRun` | 非同期エージェント実行 | 非同期エージェントの実行単位。 |
| `supportTicket` | 問い合わせチケット | 担当者対応の管理単位。 |
| `benchmarkRun` | ベンチマーク実行 | ベンチマークrun。 |
| `searchImprovementTest` | 検索改善テスト | 検索改善の反映前後を比較するテスト。 |


主な確認内容:

| 対象 | 確認できる内容 |
|---|---|
| `ingestRun` | 拡張子、前処理、抽出器、OCR、図面変換、chunk 数、警告、失敗理由 |
| `reindexRun` | 旧 indexVersion、新 indexVersion、対象件数、cutover / rollback 状態 |
| `ragRun` | searchScope、正規化 query、検索方式、取得件数、authorized 件数、rerank、evidence、回答不能理由 |
| `chatOrchestrationRun` | mode、会話圧縮、RAG step、使用チャット内ツール、回答不能理由 |
| `chatToolInvocation` | toolId、入力概要、出力概要、認可結果、エラー、実行時間 |
| `asyncAgentRun` | provider、model、workspace mount、使用 skill / agent profile、成果物、失敗理由 |
| `supportTicket` | 問い合わせ化理由、sanitized diagnostics、担当者メモ、回答案 |
| `benchmarkRun` | suite、失敗ケース、metrics、前回比、artifact |
| `searchImprovementTest` | 反映前後の検索結果差分、影響範囲 |

------

## 14A.3 Debug trace データ

### 型定義: `DebugTrace`（デバッグトレース）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `DebugTrace` | デバッグトレース | 処理の流れ、イベント、指標、警告を安全に確認するための診断記録。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `traceId` | トレースID | 必須 | `string` | トレースIDを一意に識別するためのIDです。 |
| `tenantId` | テナントID | 必須 | `string` | テナントIDを一意に識別するためのIDです。 |
| `targetType` | 対象種別 | 必須 | `DebugTargetType` | このデータで管理する「対象種別」です。 |
| `targetId` | 対象ID | 必須 | `string` | 対象IDを一意に識別するためのIDです。 |
| `visibility` | 表示レベル | 必須 | `"user_safe" / "support_sanitized" / "operator_sanitized" / "internal_restricted"` | このデータで管理する「表示レベル」です。 |
| `status` | 状態 | 必須 | `"running" / "completed" / "failed"` | 対象の現在の状態を示します。 |
| `events` | イベント一覧 | 必須 | `DebugTraceEvent[]` | このデータで管理する「イベント一覧」です。 |
| `metrics` | 指標 | 任意 | `Record<string, number>` | 指標を数値で管理します。 |
| `warnings` | 警告一覧 | 任意 | `IngestWarning[]` | 注意が必要な警告一覧を記録します。 |
| `sanitized` | 無害化済み | 必須 | `boolean` | 無害化済みを有効にするか、条件を満たすかを示します。 |
| `redactionPolicyVersion` | 伏せ字ポリシーバージョン | 必須 | `string` | 利用した伏せ字ポリシーバージョンを記録し、再実行や差分確認に使います。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `expiresAt` | 有効期限 | 任意 | `string` | 有効期限を記録します。 |


### 型定義: `DebugTraceEvent`（デバッグトレースイベント）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `DebugTraceEvent` | デバッグトレースイベント | デバッグトレース内の1つの処理ステップと結果。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `eventId` | イベントID | 必須 | `string` | イベントIDを一意に識別するためのIDです。 |
| `step` | 処理ステップ | 必須 | `\| "validate" \| "preprocess" \| "extract" \| "chunk" \| "embed" \| "index" \| "search_scope_normalize" \| "build_conversation_state" \| "decontextualize_query" \| "question_requirement_slot_detect" \| "structur ...` | このデータで管理する「処理ステップ」です。 |
| `status` | 状態 | 必須 | `"started" / "succeeded" / "failed" / "skipped"` | 対象の現在の状態を示します。 |
| `startedAt` | 開始日時 | 必須 | `string` | 開始日時を記録します。 |
| `completedAt` | 完了日時 | 任意 | `string` | 完了日時を記録します。 |
| `latencyMs` | 処理時間ミリ秒 | 任意 | `number` | 処理時間ミリ秒を数値で管理します。 |
| `inputSummary` | 入力要約 | 任意 | `unknown` | このデータで管理する「入力要約」です。 |
| `outputSummary` | 出力要約 | 任意 | `unknown` | このデータで管理する「出力要約」です。 |
| `counts` | 件数 | 任意 | `object（主な項目: inputDocuments, authorizedDocuments, retrievedChunks, authorizedChunks, selectedEvidence, generatedChunks）` | このデータで管理する「件数」です。 |
| `errorCode` | エラーコード | 任意 | `string` | このデータで管理する「エラーコード」です。 |
| `errorMessage` | エラーメッセージ | 任意 | `string` | エラーメッセージとして表示または処理する文字列です。 |


------


## 14A.3A 品質・解析デバッグ

品質・解析デバッグでは、RAGがなぜ文書を使ったか、または使わなかったかを確認できます。ただし、debug 権限は文書閲覧権限を拡張しません。

```text
確認できる情報:
- quality policy の適用結果
- ragEligibility
- verificationStatus
- freshnessStatus
- supersessionStatus
- extractionQualityStatus
- OCR confidence
- table extraction confidence
- figure analysis confidence
- quality filter による除外理由
- parse warning
- citation reference の検証結果
```

表示制御は次です。

```text
user_safe:
品質警告、回答不能理由、次アクションのみ。

support_sanitized:
問い合わせ化された会話と sanitized quality diagnostics。

operator_sanitized:
権限内文書について、品質除外理由、OCR / 表 / 図の信頼度、chunk preview を表示。

internal_restricted:
parserVersion、layoutModelVersion、tableExtractorVersion、quality policy 評価詳細を表示。
```

```
禁止:
- 権限外文書名を出す
- 権限外フォルダ名を出す
- 権限外文書が品質フィルタで除外されたことを示す
- LLM の内部推論を出す
```



## 14A.3B 回答生成・マルチターン debug

回答生成 debug は、回答品質を改善するための trace です。
ただし、利用者向けには権限外文書名、内部 judge prompt、LLM の内部推論を出しません。

operator_sanitized 以上で確認できる項目:

```text
- standaloneQuestion
- turnDependency
- previousCitationAnchors の件数
- ignoredAssistantMessageIds と refusal filtering の有無
- RequiredFact の factId、necessity、factType
- sufficient_context_gate の judgement
- primaryFactsSupported
- missingPrimaryFactIds / conflictingPrimaryFactIds
- final answer context の minScore filter 件数
- high-confidence early stop の有無
- riskSignals
- computedFacts の種別と supportingEvidenceIds
- usedSpans の件数と groundingType
- citation validation result
- unsupportedSentences
- supportingComputedFactIds
- contradictionChunkIds
- answer repair attempted / succeeded
```

表示しない項目:

```text
- LLM の内部推論
- 権限外文書名、権限外フォルダ名、権限外 chunk
- 権限外文書の品質状態
- raw prompt の秘密情報
- provider credential
```

### 型定義: `AnswerGenerationDebugSummary`（回答生成デバッグ要約）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `AnswerGenerationDebugSummary` | 回答生成デバッグ要約 | 回答可否、質問要求、支持検証、修復結果を要約した診断情報。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `ragRunId` | RAG実行ID | 必須 | `string` | RAG実行IDを一意に識別するためのIDです。 |
| `conversation` | 会話 | 任意 | `object（主な項目: standaloneQuestion, turnDependency, previousCitationAnchorCount, refusalFiltered）` | このデータで管理する「会話」です。 |
| `answerability` | 回答可否 | 任意 | `SufficientContextJudgement` | このデータで管理する「回答可否」です。 |
| `requirementSlots` | 質問要求スロット | 任意 | `string[]` | 質問要求スロットを有効にするか、条件を満たすかを示します。 |
| `finalContext` | final文脈 | 任意 | `object（主な項目: candidateChunkCount, selectedChunkCount, droppedByMinScoreCount, highConfidenceEarlyStop）` | final文脈として表示または処理する文字列です。 |
| `supportVerification` | 支持検証結果 | 任意 | `AnswerSupportJudgement` | このデータで管理する「支持検証結果」です。 |
| `riskSignals` | リスクシグナル | 任意 | `RetrievalRiskSignal[]` | このデータで管理する「リスクシグナル」です。 |
| `computedFactCount` | 計算済み事実数 | 任意 | `number` | 計算済み事実数を数値で管理します。 |
| `usedSpanCount` | 利用スパン数 | 任意 | `number` | 利用スパン数を有効にするか、条件を満たすかを示します。 |


------


## 14A.4 表示レベル

| 表示レベル | 想定利用者 | 表示内容 | 非表示にする内容 |
|---|---|---|---|
| `user_safe` | 一般利用者 | 回答範囲、処理中表示、回答不能理由、次のアクション | score、内部 query、権限外件数、tool 詳細 |
| `support_sanitized` | 問い合わせ担当 | 元質問、AI回答、citation、sanitized diagnostics、担当者メモ | 権限外文書名、内部 policy、秘密情報 |
| `operator_sanitized` | RAG運用 / デバッグ担当 | 検索方式、件数、score、chunk preview、前処理警告、tool 概要 | 権限外文書詳細、未承認の外部 payload |
| `internal_restricted` | システム管理 / 開発保守 | schema validation 結果、設定バージョン、詳細エラー | LLM の内部推論、不要な個人情報 |

重要:

```text
- LLM の内部推論は保存しない、表示しない。
- 権限外文書が何件あったかを一般利用者に出さない。
- support_sanitized でも、問い合わせ化された範囲を超えて会話本文を出さない。
- raw file や raw chunk の表示は、その文書の readOnly 以上を持つ場合だけ許可する。
```

------

## 14A.5 デバッグ画面

```text
/admin/debug
  ├─ RAG run
  ├─ Ingest run
  ├─ Reindex run
  ├─ Agent run
  ├─ Tool invocation
  ├─ Benchmark run
  └─ Search improvement test
```

RAG run 詳細:

```text
- 質問
- 回答範囲
- 正規化 query
- query rewrite / expansion
- lexical / vector 検索件数
- authorized chunk 件数
- rerank 上位 chunk
- answer に使った evidence
- groundedness check 結果
- answer_unavailable reason
- sanitize 済み debug trace
```

Ingest run 詳細:

```text
- ファイル名 / 拡張子 / MIME / サイズ
- 拡張子別の前処理結果
- 抽出器 / 変換器 / OCR のバージョン
- page / slide / sheet / drawing sheet 件数
- 図面 metadata 抽出結果
- chunk 数 / token 分布
- chunk preview
- 警告 / エラー
```

Agent / Tool 詳細:

```text
- agent mode
- toolId
- tool 実行順
- 認可チェック結果
- 承認者 / 承認時刻
- inputSummary / outputSummary
- エラーコード
```

------

## 14A.6 デバッグ export / replay

デバッグ export は、JSON artifact として出力できます。

```text
export 対象:
- DebugTrace
- run metadata
- sanitized events
- metrics
- warnings
- selected citations
```

export に含めないもの:

```text
- 権限外文書名
- 内部 policy の詳細
- raw credential
- 外部ツールの秘密 payload
- LLM の内部推論
```

replay は、同一 indexVersion、retrieverVersion、promptVersion、modelId を指定して、検索・rerank・回答生成の再現性を確認するために使います。
raw file の再処理を伴う replay は、対象フォルダ full と `debug:replay` を必須にします。

------

## 14A.7 デバッグの認可

```text
debug:trace:read:self
debug:trace:read:sanitized
debug:trace:read:internal
debug:trace:export
debug:ingest:read
debug:chunk:read
debug:replay
debug:settings:update
debug:answer_generation:read
debug:answer_generation:export
```

認可ルール:

```text
一般利用者:
- 自分の chat / ragRun の user_safe trace だけ確認できる。

問い合わせ担当:
- 割当 ticket に紐づく support_sanitized trace を確認できる。

RAG運用担当:
- 対象文書 / フォルダに readOnly 以上がある run の operator_sanitized trace を確認できる。

デバッグ管理者:
- internal_restricted trace を確認できる。
- raw chunk preview は対象フォルダ readOnly 以上が必要。
- replay は対象フォルダ full が必要。
```

------

## 14A.8 受け入れ条件

```text
AC-DEBUG-001:
RAG run、ingest run、ChatOrchestrationRun、AsyncAgentRun、tool invocation の trace を確認できる。

AC-DEBUG-002:
debug trace は表示レベルごとに sanitize される。

AC-DEBUG-003:
一般利用者向け debug には権限外文書数、文書名、内部 policy を含めない。

AC-DEBUG-004:
運用者向け debug でも、raw chunk preview は対象文書への readOnly 以上が必要。

AC-DEBUG-005:
LLM の内部推論は保存・表示しない。

AC-DEBUG-006:
取り込み debug では、拡張子別の前処理、抽出器、chunk 数、警告、エラーを確認できる。

AC-DEBUG-007:
図面系 debug では、図面番号、改訂、尺度、単位、layer、bbox、title block の抽出結果を確認できる。

AC-DEBUG-008:
trace export には debug:trace:export が必要で、export 内容は sanitize 済みに限定する。

AC-DEBUG-009:
replay 実行には debug:replay と対象フォルダ full が必要。

AC-DEBUG-010:
debug trace の閲覧、export、replay は監査ログに残る。

AC-DEBUG-011:
回答生成 debug では RequiredFact、SufficientContextJudgement、AnswerSupportJudgement、usedSpans、computedFacts を sanitize 済みで確認できる。

AC-DEBUG-012:
利用者向け debug には unsupported sentence の詳細、内部 judge prompt、権限外文書名、内部 policy 詳細を表示しない。

AC-DEBUG-013:
answer repair の実行有無、修復成功、再検証結果を trace に保存できる。

AC-DEBUG-014:
マルチターン debug では standaloneQuestion、turnDependency、previous citation anchor の件数を確認できる。
```

------


# 14B. API契約・OpenAPI / oRPC・開発品質ゲート

## 14B.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| API contract | API契約 | REST、oRPC、OpenAPI、共有型の整合性を保証する仕様。 |
| OpenAPI | オープンAPI仕様 | APIのURL、入力、出力を機械可読に表す仕様。 |
| oRPC | oRPC | API手続きを型安全に共有する仕組み。RESTとの整合性をCIで検査する。 |
| API drift gate | API差分ゲート | REST/oRPC/OpenAPI/共有型のずれを検出する品質ゲート。 |
| UI inventory | UI棚卸し | 実装から画面、機能、部品、操作要素を静的解析して一覧化する成果物。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| ApiContractArtifact | API契約成果物 | OpenAPI、oRPC、共有contract、生成docsなどを管理する。 |
| WebUiInventoryItem | Web UI棚卸し項目 | 画面、コンポーネント、操作要素、確度を管理する。 |

### 守るべきルール
- GET /openapi.jsonをruntime source of truthとする。
- 生成Markdownは派生成果物として扱い、手修正を正本にしない。
- REST、oRPC、OpenAPI、shared contractのdriftをCIで検出する。
- UI inventoryはconfirmed、inferred、unknownの確度を持つ。

### 実行すべき処理
1. API contractを生成し、OpenAPIとoRPCの整合性を検査する。
2. OpenAPI docsを自動生成し、差分があればPRまたはgateで扱う。
3. Web UI inventoryを静的解析で生成し、仕様との差分を確認する。

### UI
- 管理画面にAPI contract、drift結果、OpenAPI docs、UI inventoryの状態を表示する。
- 差分やbreaking changeは非技術者にも分かる要約で表示する。

------

## 14B.1 目的

API契約は、Web UI、API、ベンチマーク runner、非同期 worker、外部連携が同じ schema と互換性を保つための正本です。
REST endpoint、oRPC procedure、OpenAPI、共有型、生成ドキュメントの責務を分けます。

```text
contract source of truth:
packages/contract 等に置く Zod schema、oRPC contract、共有型。

runtime API source of truth:
GET /openapi.json が返す OpenAPI JSON。

generated docs:
OpenAPI JSON から生成される Markdown。派生成果物であり、手編集を正本にしない。
```

## 14B.2 API契約データ

### 型定義: `ApiContractArtifact`（API契約成果物）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ApiContractArtifact` | API契約成果物 | OpenAPI/oRPC/共有型の整合性、ドキュメント品質、生成物を管理する成果物。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `artifactId` | 成果物ID | 必須 | `string` | 成果物IDを一意に識別するためのIDです。 |
| `contractVersion` | 契約バージョン | 必須 | `string` | 利用した契約バージョンを記録し、再実行や差分確認に使います。 |
| `sourceCommitSha` | 元コミットSHA | 必須 | `string` | このデータで管理する「元コミットSHA」です。 |
| `generatedAt` | 生成日時 | 必須 | `string` | 生成日時を記録します。 |
| `restEndpointCount` | RESTエンドポイント数 | 必須 | `number` | RESTエンドポイント数を数値で管理します。 |
| `orpcProcedureCount` | oRPC手続き数 | 必須 | `number` | oRPC手続き数を数値で管理します。 |
| `openApiPathCount` | OpenAPIパス数 | 必須 | `number` | OpenAPIパス数を数値で管理します。 |
| `driftStatus` | 差分状態 | 必須 | `"not_checked" / "passed" / "rest_or_orpc_missing" / "schema_mismatch" / "docs_outdated" / "failed"` | 対象の現在の差分状態を示します。 |
| `docsQualityStatus` | ドキュメント品質状態 | 必須 | `"passed" / "missing_operation_description" / "missing_field_description" / "failed"` | 対象の現在のドキュメント品質状態を示します。 |
| `artifacts` | 成果物一覧 | 必須 | `object（主な項目: openApiJsonPath, openApiMarkdownPath, driftReportPath）` | このデータで管理する「成果物一覧」です。 |


## 14B.3 REST / oRPC / OpenAPI の責務

```text
REST endpoint:
ブラウザ、外部連携、非同期 runner、運用 workflow から呼べる HTTP API。

/oRPC procedure:
型安全なアプリ内部・フロントエンド向け RPC 契約。

OpenAPI:
REST API の runtime contract、外部連携、ドキュメント生成、contract test の入力。

shared contract:
Zod schema、型、request / response schema、validation error schema の正本。
```

必須方針です。

```text
- REST endpoint と oRPC procedure は、同じ use case を扱う場合、request / response schema の意味を揃える。
- OpenAPI に出る schema は shared contract から生成または検証する。
- runtime の GET /openapi.json を source of truth とし、生成 Markdown は派生成果物とする。
- breaking change は versioning または migration note を必須にする。
```

## 14B.4 API drift gate

API drift gate は、仕様、contract、REST、oRPC、OpenAPI、docs の乖離を検出します。

```text
1. shared contract を build する。
2. REST route と oRPC procedure を収集する。
3. OpenAPI JSON を生成する。
4. REST / oRPC / OpenAPI の schema を比較する。
5. operationId、summary、description、request schema、response schema を検査する。
6. 生成 Markdown と repository 上の docs 差分を確認する。
7. drift があれば CI を失敗させる。
```

## 14B.5 OpenAPI ドキュメント自動更新 PR

OpenAPI Markdown は CI で自動生成し、差分がある場合は更新 PR を作ります。

```text
1. GET /openapi.json 相当の生成結果を取得する。
2. docs/generated/openapi.md 等を生成する。
3. operation summary / description を検査する。
4. field description の日本語記述を検査する。
5. 既存 docs と差分がある場合、GitHub Actions が PR を作成する。
6. PR には生成元 commit、差分、品質 gate 結果を含める。
```

設定例です。

```text
OPENAPI_DOCS_PR_TOKEN:
OpenAPI docs 更新 PR を作成するための GitHub token。
```

## 14B.6 Web UI inventory の静的解析生成

実装から Web UI の画面、機能、コンポーネント、操作要素を静的解析し、`docs/generated/` に inventory を生成します。
画面仕様との差分を検出するための開発品質 gate として扱います。

### 型定義: `WebUiInventoryItem`（Web UI棚卸し項目）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `WebUiInventoryItem` | Web UI棚卸し項目 | 画面、機能、コンポーネント、操作要素を実装から静的解析した項目。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `itemId` | 項目ID | 必須 | `string` | 項目IDを一意に識別するためのIDです。 |
| `route` | 画面ルート | 任意 | `string` | このデータで管理する「画面ルート」です。 |
| `componentName` | コンポーネント名 | 任意 | `string` | このデータで管理する「コンポーネント名」です。 |
| `featureName` | 機能名 | 任意 | `string` | このデータで管理する「機能名」です。 |
| `actionLabel` | アクション名 | 任意 | `string` | このデータで管理する「アクション名」です。 |
| `requiredPermission` | 必須権限 | 任意 | `string` | 必須権限を有効にするか、条件を満たすかを示します。 |
| `certainty` | 確度 | 必須 | `"confirmed" / "inferred" / "unknown"` | このデータで管理する「確度」です。 |
| `sourceFile` | 元ファイル | 必須 | `string` | このデータで管理する「元ファイル」です。 |


方針です。

```text
- confirmed: 明示的な route、permission、label から確認できる。
- inferred: コンポーネント名や props から推定できる。
- unknown: 条件付き表示、動的 route、権限別表示などで静的解析だけでは断定できない。
```

## 14B.7 後方互換同期 API と非推奨扱い

大容量文書、長時間チャット、非同期 ingest では asynchronous run を正規経路とします。
一方で、既存クライアント互換のために同期 API を残す場合があります。

```text
互換 API 例:
- POST /chat
- POST /documents
- POST /documents/uploads/{uploadId}/ingest

推奨 API 例:
- POST /chat-runs
- GET /chat-runs/{runId}
- POST /documents/uploads
- POST /documents/ingest-runs
- GET /documents/ingest-runs/{runId}
```

ルールです。

```text
- 同期 API は deprecated または compatibility と明示する。
- 500P 超 PDF、OCR、図面、複雑 PDF、長時間 RAG は非同期 API を使う。
- 互換 API の timeout failure は、可能な場合 asynchronous run への誘導を返す。
```

## 14B.8 管理画面の alias review / publish

検索改善は UI では alias と呼ばないが、実装 artifact として alias mapping を持つ場合があります。
管理画面では、versioned artifact として review / publish を明示します。

```text
1. AI または担当者が候補を作る。
2. admin/aliases 相当の管理画面で review する。
3. publish 前に検索結果差分を見る。
4. versioned artifact として publish する。
5. rollback できるように旧 version を保持する。
```

## 14B.9 受け入れ条件

```text
AC-API-CONTRACT-001:
GET /openapi.json は runtime API contract の source of truth として利用できる。

AC-API-CONTRACT-002:
REST endpoint、oRPC procedure、OpenAPI schema の drift を CI で検出できる。

AC-API-CONTRACT-003:
OpenAPI Markdown は自動生成され、手編集を正本にしない。

AC-API-CONTRACT-004:
operation summary / description、field description が不足する場合、docs quality gate が失敗する。

AC-API-CONTRACT-005:
Web UI inventory は static analysis により generated docs へ出力され、certainty を confirmed / inferred / unknown で表す。

AC-API-CONTRACT-006:
互換同期 API は deprecated / compatibility として表示され、大容量・長時間用途では非推奨とする。

AC-API-CONTRACT-007:
検索改善 artifact は review / publish / version / rollback を持つ。
```

------

# 14C. デプロイ・リリース・GitHub Actions 運用

## 14C.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| GitHub Actions | GitHub自動実行 | デプロイ、ベンチマーク起動、ユーザー作成などの運用ワークフロー。 |
| OIDC | OpenID Connect連携 | GitHub ActionsがAWSロールを安全に引き受けるための認証方式。 |
| CDK | Cloud Development Kit | AWS構成をコードで定義・デプロイする仕組み。 |
| cdk-nag | CDK構成チェック | AWS構成のセキュリティ・ベストプラクティス違反を検出する仕組み。 |
| Local mock | ローカルモック | AWSに接続せず、ローカルで認証、Bedrock、vector storeを模擬する開発モード。 |
| Spec recovery | 仕様復元 | 作業レポートやタスクから要件、受け入れ条件、設計仕様を復元する開発補助フロー。 |
| Taskfile | タスクファイル | 開発・検証コマンドの標準入口。 |

### データ
この章では、データ構造ではなく方針・ルールを中心に整理します。


### 守るべきルール
- 本番deployはGitHub Actions、OIDC、CDK、環境承認、監査で管理する。
- 長期AWSキーをGitHub secretとして直接持たない。
- API Gateway timeout quotaなどの前提条件をdeploy前に確認する。
- ローカルmockは本番同等ではないため、検証範囲を明記する。
- repository-localのskillsやspec recoveryはプロダクト内skills管理と分ける。

### 実行すべき処理
1. GitHub Actionsでsynth、cdk-nag、deploy、artifact保存を実行する。
2. OIDCでAWS roleをassumeし、環境承認後に本番deployする。
3. Cognitoユーザー作成やbenchmark起動などの運用workflowを実行する。
4. ローカルではmock Bedrock、local auth、local vector storeで開発検証する。
5. Taskfile経由でverify、dev server、CDK test、synthを実行する。

### UI
- 管理者向けにdeploy履歴、承認状態、cdk-nag結果、artifactリンクを表示する。
- 開発者向けドキュメントにはローカルmockとTaskfile手順を表示する。

------

## 14C.1 目的

デプロイ・リリース運用は、rag-assist の本番・検証環境を安全に更新するための処理です。
プロダクト利用者向け機能とは分け、CI/CD、OIDC、CDK、CloudFormation、環境承認、運用 secret を扱います。

## 14C.2 GitHub Actions / OIDC / CDK deploy workflow

```text
1. GitHub Actions workflow_dispatch または protected branch push で deploy を開始する。
2. GitHub OIDC により AWS Role を AssumeRoleWithWebIdentity する。
3. 対象 environment の GitHub environment approval を確認する。
4. npm / pnpm / task で build、test、contract check を実行する。
5. CDK synth を実行し、CloudFormation template を生成する。
6. cdk-nag を実行し、セキュリティレポートを生成する。
7. synth artifact、cdk-nag report、diff を保存する。
8. CDK deploy を実行する。
9. deploy outputs を保存し、API URL、Cognito User Pool、S3 bucket 等を後続 step に渡す。
10. smoke test、health check、OpenAPI check を実行する。
```

OIDC trust policy では、repository、branch、environment を制限します。

```text
- すべての repository から Assume できる Role を作らない。
- production では protected environment approval を必須にする。
- deploy Role と read-only validate Role を分ける。
```

## 14C.3 CDK bootstrap と cdk-nag

```text
CDK bootstrap:
対象 AWS account / region に必要な bootstrap stack を準備する。

cdk-nag:
セキュリティベストプラクティスに反する construct を検出する。

synth artifact:
CloudFormation template、asset manifest、deploy diff、nag report を artifact として保存する。
```

受け入れ方針です。

```text
- cdk-nag の警告を suppress する場合、理由を code / report に残す。
- deploy 前に synth artifact を確認できる。
- deploy outputs は secret と非 secret に分類する。
```

## 14C.4 API Gateway integration timeout quota

API Gateway REST API の Lambda integration timeout を 60 秒等に延長する場合、Service Quotas の事前確認が必要です。

```text
運用制約:
- quota 未設定の場合、deploy または runtime で失敗する可能性がある。
- timeout 延長は account-level throttle quota に影響する場合がある。
- 大容量・長時間処理は原則として非同期 run に逃がし、API timeout 延長だけで解決しない。
```

デプロイ前 checklist に追加します。

```text
- REST API integration timeout quota が必要値を満たす。
- quota request の状態を確認済み。
- timeout 延長が throttle quota に与える影響を確認済み。
```

## 14C.5 GitHub Actions からの Cognito ユーザー作成 workflow

アカウント作成画面とは別に、運用者が GitHub Actions の手動 workflow から Cognito User Pool にユーザーを作成できる場合があります。

```text
1. workflow_dispatch で email、displayName、role、group、environment を入力する。
2. environment approval を確認する。
3. GitHub OIDC で運用 Role を assume する。
4. Cognito User Pool に user を作成する。
5. 一時パスワードまたは招待メールを発行する。
6. 日本語ロール名を Cognito group 名へ正規化する。
7. 作成結果を監査ログまたは運用ログに保存する。
```

制約です。

```text
- 上位権限ロール付与は理由入力と承認を必須にする。
- GitHub Actions 実行権限を限定する。
- email、仮パスワード、token は log に出さない。
- UI 上のユーザー作成と同じ監査要件を満たす。
```

## 14C.6 ローカル開発・検証モード

ローカルでは AWS へ接続せず、mock 経路で動作確認できるようにします。

```text
環境変数例:
- MOCK_BEDROCK=true
- USE_LOCAL_VECTOR_STORE=true
- VITE_AUTH_MODE=local
```

```text
本番:
Cognito + Bedrock + S3 Vectors + S3 + DynamoDB 等を利用する。

ローカル:
local auth + mock embedding + file vector store + local API / web dev server を利用する。
```

制約です。

```text
- local auth は本番相当の認証強度を持つものではない。
- mock embedding の検索品質は本番評価に使わない。
- local vector store の結果は再現性検証用であり、本番 benchmark の合否には使わない。
- Docker Compose を使う場合も、本番 secret を mount しない。
```

## 14C.7 Repository-local agents / skills / spec recovery workflow

プロダクト内の skills / agent profile 管理とは別に、repository 自体にも開発補助 agent / skill を置けます。
これはユーザー向け機能ではなく、要件・仕様復元・実装支援の開発運用です。

```text
repository-local agent / skill:
Codex、PM、仕様復元、レビュー用のローカル定義。

product skill / agent profile:
rag-assist アプリ内で作成・共有・実行時選択される Markdown 定義。
```

spec recovery workflow は、作業レポートから仕様へ戻す trace を持ちます。

```text
RPT -> FACT -> TASK -> AC -> E2E -> OP/EXP -> REQ/SPEC
```

状態分類です。

```text
confirmed:
コード、README、docs、テスト等から確認済み。

inferred:
実装や周辺情報から推定したが、明示仕様はない。

conflict:
複数ソースで矛盾がある。

open_question:
仕様判断が必要で未確定。
```

検証 script の例です。

```text
scripts/validate_spec_recovery.py
```

## 14C.8 Taskfile による repository 操作の標準入口

開発・検証コマンドは Taskfile を標準入口にします。

```text
Taskfile から実行する対象:
- 依存関係インストール
- verify
- dev server
- API / Web test
- contract check
- docs generation
- web inventory generation
- CDK test
- CDK synth
- local benchmark smoke
```

方針です。

```text
- CI 相当確認は task verify に集約する。
- 直接 npm script を使う場合は、Taskfile から呼ばれる内部 step として扱う。
- README には Taskfile 起点の最短手順を記載する。
```

## 14C.9 受け入れ条件

```text
AC-DEPLOY-OPS-001:
GitHub Actions は OIDC で AWS Role を Assume し、長期 AWS access key を repository secret に保存しない。

AC-DEPLOY-OPS-002:
production deploy には environment approval を必須にする。

AC-DEPLOY-OPS-003:
CDK synth artifact、cdk-nag report、deploy diff を artifact として保存できる。

AC-DEPLOY-OPS-004:
API Gateway integration timeout quota の不足は deploy 前 checklist または deploy failure として検出できる。

AC-DEPLOY-OPS-005:
GitHub Actions から Cognito user を作る場合、実行者、入力、付与ロール、対象環境を監査可能にする。

AC-DEPLOY-OPS-006:
ローカル mock mode は AWS 非接続で起動でき、本番 secret を必要としない。

AC-DEPLOY-OPS-007:
repository-local agent / skill は product skill / agent profile と区別される。

AC-DEPLOY-OPS-008:
Taskfile は repository 操作の標準入口として、verify、dev、CDK synth、docs generation を実行できる。
```

------

# 14D. API共通 middleware・public endpoint・非同期 worker 実行契約

## 14D.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Middleware | ミドルウェア | APIリクエストに共通して適用する認証、CORS、ログ、エラー処理など。 |
| Public endpoint | 公開エンドポイント | 認証なしでアクセスできる/healthや/openapi.jsonなどのAPI。 |
| SSE | Server-Sent Events | サーバーからブラウザへ進捗や生成途中の内容を送る仕組み。 |
| Last-Event-ID | 最終イベントID | SSE再接続時にどこから再開するかを示すID。 |
| Worker | ワーカー | runIdを受け取り、チャット、取り込み、エージェントなどの非同期処理を実行する処理。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| WorkerEvent | ワーカーイベント | 非同期処理に渡すrunIdと対象種別を管理する。 |
| WorkerResult | ワーカー結果 | 非同期処理の成功、失敗、エラー、完了時刻を管理する。 |

### 守るべきルール
- public endpointは非機微情報に限定する。
- CORS allowlistとOPTIONS bypassを明確にする。
- SSEでは再接続とLast-Event-IDを考慮する。
- workerはrunIdを必須契約とし、失敗時の扱いを統一する。

### 実行すべき処理
1. API共通middlewareで認証、CORS、エラー、ログを処理する。
2. public endpointを認証対象から除外する。
3. SSEで進捗を配信し、切断時は再接続を処理する。
4. worker eventを受け取り、runIdに対応する処理を実行する。

### UI
- 利用者向けUIではSSEにより回答生成中、取り込み中、エージェント実行中の進捗を表示する。
- 運用者向けUIではworker状態、retry、cancel、失敗理由を表示する。

------

## 14D.1 API共通 middleware

API 横断で、CORS、認証 middleware、public path、preflight を統一します。

```text
CORS:
許可 origin を環境ごとに allowlist で管理する。

OPTIONS:
preflight は認証 middleware より前で bypass できる。

public endpoint:
/health、/openapi.json など、非機微情報だけを返す endpoint は未認証で公開できる。

protected endpoint:
/chat、/documents、/benchmarks、/admin、/rpc などは認証と feature / resource permission を必須にする。
```

public endpoint の制約です。

```text
- /health は secret、tenant 情報、内部設定を返さない。
- /openapi.json は公開可能な schema のみを返す。
- CORS allowlist は wildcard を本番で使わない。
- 認証失敗、認可失敗、存在しない resource は、権限外 resource の存在を示唆しないように扱う。
```

## 14D.2 SSE / streaming と再接続

チャットや非同期 run の進捗は SSE で返せます。

```text
- stream endpoint は runId 単位で購読する。
- Last-Event-ID を受け取った場合、可能な範囲で未送信 event から再開する。
- stream 購読時にも run への access permission を確認する。
- token 期限切れ、権限変更、run 削除時は stream を終了する。
```

## 14D.3 非同期 worker handler の実行契約

非同期 worker は、Lambda、CodeBuild、Step Functions 等から `runId` を受け取り、対応する run executor を起動します。

### 型定義: `WorkerEvent`（ワーカーイベント）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `WorkerEvent` | ワーカーイベント | 非同期処理ワーカーに渡す実行指示。runIdを持つ。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `runId` | 実行ID | 必須 | `string` | 実行IDを一意に識別するためのIDです。 |
| `tenantId` | テナントID | 任意 | `string` | テナントIDを一意に識別するためのIDです。 |
| `requestedBy` | requested者 | 任意 | `string` | requested者を示します。 |
| `retryAttempt` | 再試行回数 | 任意 | `number` | 再試行回数を数値で管理します。 |
| `traceId` | トレースID | 任意 | `string` | トレースIDを一意に識別するためのIDです。 |


### 型定義: `WorkerResult`（ワーカー結果）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `WorkerResult` | ワーカー結果 | 非同期処理ワーカーの実行結果とリトライ情報。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `runId` | 実行ID | 必須 | `string` | 実行IDを一意に識別するためのIDです。 |
| `status` | 状態 | 必須 | `"completed" / "failed" / "cancelled"` | 対象の現在の状態を示します。 |
| `errorCode` | エラーコード | 任意 | `string` | このデータで管理する「エラーコード」です。 |
| `errorMessage` | エラーメッセージ | 任意 | `string` | エラーメッセージとして表示または処理する文字列です。 |


対象例です。

```text
chat-run-worker:
runId を受け取り executeChatRun を実行する。

document-ingest-run-worker:
runId を受け取り executeDocumentIngestRun を実行する。

benchmark-run-worker:
runId を受け取り benchmark suite / corpus / metrics を処理する。

async-agent-run-worker:
runId を受け取り provider workspace を準備し、Claude Code / Codex / OpenCode 等を実行する。
```

失敗時の扱いです。

```text
- runId がない event は validation error として失敗する。
- 対象 run が存在しない場合は not_found として終了する。
- 権限変更により実行継続できない場合は permission_revoked として終了する。
- retry 可能なエラーと retry 不可のエラーを分ける。
- worker は user input、tool output、secret を log にそのまま出さない。
```

## 14D.4 受け入れ条件

```text
AC-API-MW-001:
CORS allowlist、OPTIONS bypass、public endpoint、protected endpoint の扱いが API 共通 middleware として定義される。

AC-API-MW-002:
/health と /openapi.json は非機微情報のみを返す。

AC-API-MW-003:
本番 CORS は wildcard origin を使わない。

AC-WORKER-001:
worker handler は runId を必須入力とし、欠落時は validation error にする。

AC-WORKER-002:
chat run、document ingest run、benchmark run、async agent run は runId 単位で worker 実行できる。

AC-WORKER-003:
worker 実行中に resource permission が失われた場合、実行を安全に停止または権限内処理に制限する。

AC-STREAM-001:
SSE stream は run への access permission を確認し、Last-Event-ID による再接続を扱える。
```

------

# 15. 再インデックス

## 15.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Reindex | 再インデックス | chunker、embedding、index、解析設定の変更を検索に反映する処理。 |
| Cutover | 切り替え | stagingで作った新indexを本番検索に切り替えること。 |
| Rollback | 巻き戻し | 問題があった新indexから旧indexへ戻すこと。 |
| Staging index | ステージングindex | 本番反映前に検証するための一時的なindex。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| ReindexRun | 再インデックス実行 | 対象、状態、旧index、新index、作成者、時刻を管理する。 |

### 守るべきルール
- 共有設定変更だけではembedding再計算しない。
- chunker、embedding model、parser、解析設定変更時は再インデックスまたは再解析対象にする。
- staging文書やstaging indexは通常検索対象にしない。
- cutoverとrollbackは危険操作として扱う。

### 実行すべき処理
1. 対象文書またはフォルダを選び、再インデックスrunを作成する。
2. 新indexをstagingで作成し、検証後にcutoverする。
3. 問題があれば旧indexへrollbackする。
4. 品質ステータス変更は検索時フィルタで反映し、embedding再計算を不要にする。

### UI
- 再インデックスrun詳細に対象、状態、旧/新index、進捗、検証結果を表示する。
- cutover/rollback時は危険操作ダイアログを表示する。

------

## 15.1 目的

再インデックスは、extractor、chunker、embedding、memory card、検索インデックスの変更を反映するための機能です。

共有設定変更だけでは再インデックスしません。

```text
共有設定変更:
再インデックス不要

chunker / embedding model 変更:
再インデックス必要
```

------

## 15.2 再インデックス run

### 型定義: `ReindexRun`（再インデックス実行）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `ReindexRun` | 再インデックス実行 | chunker、embedding、index変更を反映するための再構築実行単位。 |

| 英名 | 日本語名 | 必須 | 型・値 | 内容 |
|---|---|---:|---|---|
| `runId` | 実行ID | 必須 | `string` | 実行IDを一意に識別するためのIDです。 |
| `targetType` | 対象種別 | 必須 | `"document" / "folder"` | このデータで管理する「対象種別」です。 |
| `targetId` | 対象ID | 必須 | `string` | 対象IDを一意に識別するためのIDです。 |
| `includeDescendants` | 配下含む | 任意 | `boolean` | 配下含むを有効にするか、条件を満たすかを示します。 |
| `status` | 状態 | 必須 | `"queued" / "running" / "staged" / "cutover_ready" / "completed" / "failed" / "rolled_back"` | 対象の現在の状態を示します。 |
| `oldIndexVersion` | 旧インデックスバージョン | 任意 | `string` | 利用した旧インデックスバージョンを記録し、再実行や差分確認に使います。 |
| `newIndexVersion` | 新インデックスバージョン | 任意 | `string` | 利用した新インデックスバージョンを記録し、再実行や差分確認に使います。 |
| `createdBy` | 作成者ID | 必須 | `string` | 作成者IDを示します。 |
| `createdAt` | 作成日時 | 必須 | `string` | 作成日時を記録します。 |
| `updatedAt` | 更新日時 | 必須 | `string` | 更新日時を記録します。 |


------

## 15.3 認可

```text
index:rebuild
+ 対象フォルダ full
```

文書単位の場合:

```text
index:rebuild
+ 文書所属フォルダ full
```

フォルダ単位の場合:

```text
index:rebuild
+ 対象フォルダ full
```

------

## 15.4 受け入れ条件

```text
AC-REINDEX-001:
再インデックスには index:rebuild と対象フォルダ full が必要。

AC-REINDEX-002:
staging 文書は検索対象にならない。

AC-REINDEX-003:
cutover 前後で共有設定は変わらない。

AC-REINDEX-004:
rollback により旧 indexVersion へ戻せる。

AC-REINDEX-005:
共有設定変更だけでは embedding 再計算しない。

AC-REINDEX-006:
cutover / rollback は危険操作として扱う。
```

------


## 15.5 再解析・品質ステータス変更

再解析は、extractor / parser / OCR / layout / table / figure analyzer の変更、または解析失敗・低信頼の改善を反映するために行います。

```text
再解析が必要:
- parserVersion 変更
- ocrEngineVersion 変更
- layoutModelVersion 変更
- tableExtractorVersion 変更
- figureAnalyzerVersion 変更
- OCR設定変更
- 表抽出設定変更
- 図解析設定変更
- 解析失敗ページの再処理
- 低信頼OCRページの再処理
```

品質ステータス変更だけでは embedding 再計算は不要です。

```text
embedding 再計算不要:
- verificationStatus 変更
- freshnessStatus 変更
- supersessionStatus 変更
- ragEligibility 変更
- contentOwner 変更
- nextReviewDueAt 変更
```

これらは検索時の quality policy / manifest 再確認で即時反映します。

```text
AC-REPARSE-001:
再解析前後の抽出差分を確認できる。

AC-REPARSE-002:
再解析により RAG利用可否が変わる場合、cutover 前に確認できる。

AC-REPARSE-003:
品質ステータス変更は embedding 再計算なしで RAG 検索に反映される。

AC-REPARSE-004:
再解析、OCR再実行、表レビュー、図レビューは監査ログに記録される。
```

------

# 16. 全体権限定義

## 16.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Account status | アカウント状態 | ユーザーがactive、suspended、deletedなどどの状態かを示す。 |
| Feature permission | 機能権限 | API、画面、操作を使えるかを示す権限。 |
| Resource permission | リソース権限 | 対象フォルダ、文書、runなどに対して何ができるかを示す権限。 |

### データ
この章では、データ構造ではなく方針・ルールを中心に整理します。


### 守るべきルール
- 操作可否はAccount status、Feature permission、Resource permissionの3層で判定する。
- 機能権限があっても対象リソース権限がなければ操作できない。
- リソース権限があっても機能権限がなければ操作できない。

### 実行すべき処理
1. 操作ごとに必要なfeature permissionを確認する。
2. 対象ごとにresource permissionを計算する。
3. 両方を満たした場合のみ処理を実行する。

### UI
- 権限エラー時は、対象の存在を示唆しない安全なメッセージを表示する。
- 管理画面では権限不足の理由を権限範囲内で表示する。

------

## 16.1 権限の階層

権限は 3 層で定義します。

```text
Layer 1: Account status
ユーザーが active か。

Layer 2: Feature permission
その機能を使えるか。

Layer 3: Resource permission
その対象に何ができるか。
```

例:

```text
チャットで Aさん /xxx に質問する

1. User status = active
2. chat:create を持つ
3. Aさん /xxx に readOnly 以上を持つ
```

------

# 17. Resource-level permission

## 17.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| EffectiveFolderPermission | 実効フォルダ権限 | ユーザーが対象フォルダに対して最終的に持つnone/readOnly/fullの権限。 |
| readOnly | 閲覧のみ | 閲覧、ダウンロード、RAG参照、citation表示ができる権限。 |
| full | 管理可能 | readOnlyに加え、アップロード、削除、移動、共有変更、再インデックスができる権限。 |
| none | 権限なし | 対象を見られず、検索対象にも引用にも出ない状態。 |

### データ
| 英名 | 日本語名 | 内容 |
|---|---|---|
| EffectiveFolderPermission | 実効フォルダ権限 | none/readOnly/fullのいずれかを表す。 |

### 守るべきルール
- readOnly未満の文書はRAG検索対象外。
- noneの対象は一覧、検索、citation、debug traceの利用者表示に出さない。
- fullは危険操作を含むため、理由入力や監査ログを必要にする場合がある。

### 実行すべき処理
1. 個人共有、グループ共有、階層継承から実効権限を計算する。
2. API、UI、RAG検索前に実効権限を確認する。
3. 権限変更後は再インデックスなしで検索対象から除外する。

### UI
- 文書・フォルダ一覧に自分の権限を表示する。
- 権限外対象は表示しないか、詳細を隠したアクセス不可表示にする。

------

## 17.1 フォルダ権限

フォルダの resource permission は 3 種類です。

### 型定義: `EffectiveFolderPermission`（実効フォルダ権限）

| 英名 | 日本語名 | 内容 |
|---|---|---|
| `EffectiveFolderPermission` | 実効フォルダ権限 | ユーザーが対象フォルダに対して最終的に持つ none/readOnly/full の権限。 |

| 英名（値） | 日本語名 | 内容 |
|---|---|---|
| `none` | 権限なし | 対象を閲覧・検索・引用できない。 |
| `readOnly` | 閲覧のみ | 参照、検索、ダウンロードなどはできるが変更はできない。 |
| `full` | 管理可能 | 閲覧に加えて、更新、削除、共有などの管理操作ができる。 |


------

## 17.2 readOnly

```text
readOnly で可能:
- RAG参照
- ファイル閲覧
- ダウンロード
- citation 表示
- 履歴内の参照継続
readOnly で不可:
- アップロード
- 削除
- 移動
- 名前変更
- 再インデックス
- 共有追加
- 共有削除
- 子フォルダ作成
```

------

## 17.3 full

```text
full で可能:
- readOnly のすべて
- アップロード
- 削除
- 移動
- 名前変更
- ファイル名変更
- 再インデックス
- 共有追加
- 共有削除
- 子フォルダ作成
- 個別共有設定作成
- 個別共有設定削除
```

------

## 17.4 none

```text
none:
- フォルダ一覧に出ない
- 文書一覧に出ない
- RAG検索対象にならない
- citation に出ない
- 存在を示唆しない
```

------

# 18. Feature-level permission

## 18.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Feature permission | 機能権限 | チャット送信、文書アップロード、benchmark実行など、機能そのものを使えるかを示す権限。 |
| Permission namespace | 権限名前空間 | chat、document、benchmark、agentなど、権限を機能領域ごとに分類する接頭辞。 |

### データ
この章では、データ構造ではなく方針・ルールを中心に整理します。


### 守るべきルール
- feature permissionだけでは実リソース操作を許可しない。
- resource permissionと組み合わせて初めて処理を実行する。
- 危険操作や高権限操作は細かいpermissionに分ける。

### 実行すべき処理
1. 機能ごとに必要permissionを定義する。
2. ロールにpermissionを割り当てる。
3. APIや画面操作の入口でpermissionを確認する。

### UI
- ロール・権限管理画面でpermission一覧と割当ロールを確認できる。
- 権限不足時は機能が非表示またはdisabledになる。

------

## 18.1 チャット系

```text
chat:create
chat:attachment:create
chat:feedback:create
chat:session:read:self
chat:session:update:self
chat:session:delete:self
```

------

## 18.2 履歴・お気に入り

```text
history:read:self
history:update:self
history:delete:self

favorite:read:self
favorite:create:self
favorite:delete:self
```

------

## 18.3 フォルダ・文書

```text
folder:create:personal
folder:create:group
folder:read
folder:update
folder:delete
folder:move
folder:share

document:read
document:download
document:upload
document:update
document:delete
document:move
```

ただし、これらは feature permission だけでは実行できません。
必ず対象フォルダの `full` または `readOnly` を確認します。

------

## 18.4 インデックス

```text
index:rebuild
index:cutover
index:rollback
```

対象フォルダ `full` が必要です。

------

## 18.5 検索改善

```text
search_improvement:read
search_improvement:suggest
search_improvement:review
search_improvement:publish
search_improvement:disable
```

------

## 18.6 ベンチマーク

```text
benchmark:read
benchmark:suite:create
benchmark:suite:update
benchmark:case:create
benchmark:case:update
benchmark:run
benchmark:cancel
benchmark:artifact:download
benchmark:promote_result
```

------

## 18.7 問い合わせ対応

```text
support:ticket:read
support:ticket:update
support:ticket:assign
support:ticket:close
```

------

## 18.8 ユーザー・グループ

```text
user:read
user:create
user:update
user:suspend
user:delete

group:read
group:create
group:update
group:archive
group:membership:update
```

------

## 18.9 ロール・アクセス管理

```text
role:read
role:assign
role:revoke
permission:read
```

------

## 18.10 利用状況・コスト

```text
usage:read:aggregate
usage:read:user

cost:read:aggregate
cost:read:user
cost:export
```

------

## 18.11 監査ログ

```text
audit:read
audit:export
```

------

## 18.12 チャット内RAG・チャット内ツール

```text
rag:run
rag:trace:read:sanitized
rag:trace:read:internal
rag:answer_policy:read
rag:answer_policy:update
rag:context_policy:read
rag:context_policy:update
rag:benchmark_answer_policy:use

chat_orchestration:trace:read:self
chat_orchestration:trace:read:sanitized
chat_orchestration:trace:read:internal

chat_tool:read
chat_tool:execute
chat_tool:approve

tool:credential:use
tool:credential:manage
```

原則として、通常チャットの RAG 実行は `chat:create` に含めてもよいです。
ただし、検索テスト、管理者向け trace、チャット内ツール承認、外部連携 credential 利用は明示権限に分けます。

```text
通常利用者:
chat:create により RAG回答を利用できる。

運用者:
rag:trace:read:sanitized と chat_orchestration:trace:read:sanitized により sanitize 済み trace を確認できる。

内部管理者:
rag:trace:read:internal / chat_orchestration:trace:read:internal は強権限として扱う。
```

------

## 18.13 問い合わせ・回答不能

```text
support:ticket:create:self
support:ticket:read
support:ticket:update
support:ticket:assign
support:ticket:close
support:draft_answer:create
support:draft_answer:review
support:draft_answer:send
```

------

## 18.14 デバッグ・運用診断

```text
debug:trace:read:self
debug:trace:read:sanitized
debug:trace:read:internal
debug:trace:export
debug:ingest:read
debug:chunk:read
debug:replay
debug:settings:update
```

デバッグ権限は、通常の文書閲覧権限を拡張しません。

```text
debug 権限がある
≠
すべての文書 chunk を見られる
```

raw chunk preview、raw extraction preview、replay は、対象フォルダ / 文書への resource permission を必須にします。

------

## 18.15 非同期エージェント実行

```text
agent:run
agent:cancel
agent:read:self
agent:read:managed
agent:trace:read:self
agent:trace:read:sanitized
agent:trace:read:internal
agent:artifact:download
agent:artifact:writeback
agent:settings:manage
agent:provider:manage
```

`agent:*` は非同期エージェント実行を指します。
チャット内オーケストレーションとは別です。

```text
agent:run:
Claude Code / Codex / OpenCode / custom の実行器を起動できる。

agent:artifact:writeback:
成果物をフォルダへ保存または既存ファイルへ反映できる。
対象フォルダ full と明示承認が必要。

agent:provider:manage:
利用可能 provider、モデル、実行環境、ネットワーク制限を管理できる。
```

------

## 18.16 skills / agent profile

```text
skill:read
skill:create
skill:update
skill:delete
skill:share
skill:generate_with_ai

agent_profile:read
agent_profile:create
agent_profile:update
agent_profile:delete
agent_profile:share
agent_profile:generate_with_ai

agent_preset:read:self
agent_preset:create:self
agent_preset:update:self
agent_preset:delete:self
```

skill / agent profile の共有には、フォルダと同じ resource permission を使います。

```text
readOnly:
参照・実行時選択できる。

full:
作成・編集・削除・共有設定変更できる。
```

------

## 18.17 個人設定・アカウント

```text
settings:read:self
settings:update:self

auth:password:update:self
auth:password:reset:request
auth:password:reset:complete
auth:mfa:update:self
auth:session:revoke:self

account:create
account:delete:self
account:delete:managed
account:suspend
account:restore
```

個人設定は本人だけが更新できます。
管理者がユーザーの設定を直接書き換える場合は、専用の管理権限と監査ログを必須にします。

------


## 18.18 ナレッジ品質・高度文書解析

```text
quality:read
quality:update
quality:verify
quality:exclude
quality:review_request:create
quality:conflict:detect
quality:policy:read
quality:policy:update

parse:read
parse:reanalyze
parse:ocr:rerun
parse:table:review
parse:figure:review
parse:diff:read
```

品質ステータス変更、RAG除外、再解析、OCR再実行は危険操作です。
対象フォルダ `full` と理由入力を必須にします。

------



## 18.19 API契約・開発品質ゲート・デプロイ運用

```text
api_contract:read
api_contract:check
api_contract:drift:read
api_contract:docs:generate
api_contract:docs:publish_pr

ui_inventory:read
ui_inventory:generate

ci:benchmark:run
ci:deploy:run
ci:cognito_user:create
ci:artifact:read

ops:deploy:read
ops:deploy:approve
ops:quota:read
ops:local_mode:read

worker:run:read
worker:run:retry
worker:run:cancel
```

これらは開発・運用向け権限であり、通常のプロダクト利用者には付与しません。
`ci:deploy:run`、`ci:cognito_user:create`、`api_contract:docs:publish_pr` は危険操作として扱います。

# 19. ロールプリセット

## 19.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Role preset | ロールプリセット | 一般利用者、管理者、運用者など典型的な職務に合わせた権限セット。 |
| System admin | システム管理者 | 全体管理を行う強権限ロール。ただし会話本文の無制限閲覧は避ける。 |

### データ
この章では、データ構造ではなく方針・ルールを中心に整理します。


### 守るべきルール
- ロールプリセットは職務に合わせて最小権限で設計する。
- 強権限ロール付与時は理由入力と監査ログを必須にする。
- システム管理者でも会話本文の閲覧は必要範囲に制限する。

### 実行すべき処理
1. 職務ごとに必要なpermissionをまとめる。
2. ロール変更時に変更前後の差分と影響を表示する。
3. 運用に合わせてプリセットを見直す。

### UI
- ロール一覧でプリセット名、説明、含まれるpermission、危険権限を表示する。
- ロール付与ダイアログで影響と理由入力を表示する。

------

## 19.1 一般利用者

```text
Role: CHAT_USER

permissions:
- chat:create
- chat:attachment:create
- chat:feedback:create
- chat:session:read:self
- chat:session:update:self
- chat:session:delete:self
- history:read:self
- history:update:self
- history:delete:self
- favorite:read:self
- favorite:create:self
- favorite:delete:self
- document:read
- document:download
```

できること:

```text
- 自分が読める資料に質問する
- 自分の履歴を見る
- お気に入り登録する
- readOnly 以上の資料を閲覧・DLする
```

------

## 19.2 個人フォルダ作成者

```text
Role: PERSONAL_FOLDER_CREATOR

permissions:
- folder:create:personal
- document:upload
- document:update
- document:delete
- document:move
- folder:update
- folder:delete
- folder:move
- folder:share
- index:rebuild
```

ただし、自分が管理者のフォルダに対してのみ実行可能です。

------

## 19.3 グループフォルダ管理者

```text
Role: GROUP_FOLDER_MANAGER

permissions:
- folder:create:group
- folder:update
- folder:delete
- folder:move
- folder:share
- document:upload
- document:update
- document:delete
- document:move
- index:rebuild
- index:cutover
- index:rollback
```

対象グループ内で `full` を持つフォルダだけ管理できます。

------

## 19.4 問い合わせ担当者

```text
Role: SUPPORT_AGENT

permissions:
- support:ticket:read
- support:ticket:update
- support:ticket:assign
- support:ticket:close
- search_improvement:suggest
```

------

## 19.5 検索改善担当者

```text
Role: SEARCH_IMPROVER

permissions:
- search_improvement:read
- search_improvement:suggest
- search_improvement:review
```

------

## 19.6 検索改善公開者

```text
Role: SEARCH_PUBLISHER

permissions:
- search_improvement:publish
- search_improvement:disable
```

------

## 19.7 ベンチマーク担当者

```text
Role: BENCHMARK_RUNNER

permissions:
- benchmark:read
- benchmark:run
- benchmark:cancel
- benchmark:artifact:download
```

------

## 19.8 ベンチマーク管理者

```text
Role: BENCHMARK_ADMIN

permissions:
- benchmark:read
- benchmark:suite:create
- benchmark:suite:update
- benchmark:case:create
- benchmark:case:update
- benchmark:run
- benchmark:cancel
- benchmark:artifact:download
- benchmark:promote_result
```

------

## 19.9 ユーザー・グループ管理者

```text
Role: USER_GROUP_ADMIN

permissions:
- user:read
- user:create
- user:update
- user:suspend
- group:read
- group:create
- group:update
- group:archive
- group:membership:update
```

------

## 19.10 アクセス管理者

```text
Role: ACCESS_ADMIN

permissions:
- user:read
- group:read
- role:read
- role:assign
- role:revoke
- permission:read
- audit:read
```

------

## 19.11 コスト監査者

```text
Role: COST_AUDITOR

permissions:
- usage:read:aggregate
- usage:read:user
- cost:read:aggregate
- cost:read:user
- cost:export
```

------

## 19.12 監査担当者

```text
Role: AUDIT_VIEWER

permissions:
- audit:read
- audit:export
```

------

## 19.13 システム管理者

```text
Role: SYSTEM_ADMIN

permissions:
- all
```

ただし、システム管理者でも会話本文の無制限閲覧は避けるべきです。

```text
原則:
会話本文は本人または問い合わせ対応に必要な範囲のみ閲覧可能
```

------

## 19.14 RAG運用担当者

```text
Role: RAG_OPERATOR

permissions:
- rag:trace:read:sanitized
- search_improvement:read
- search_improvement:suggest
- benchmark:read
- benchmark:run
- index:rebuild
```

できること:

```text
- RAG回答の sanitize 済み trace を確認する
- 検索失敗を分析する
- 検索改善候補を作成する
- benchmark を実行する
- 権限のあるフォルダを再インデックスする
```

------

## 19.15 チャット内ツール管理者

```text
Role: CHAT_TOOL_OPERATOR

permissions:
- chat_orchestration:trace:read:sanitized
- chat_tool:read
- chat_tool:execute
- chat_tool:approve
- rag:trace:read:sanitized
```

できること:

```text
- チャット内オーケストレーションの sanitize 済み trace を確認する
- チャット内ツール実行を確認する
- 承認が必要なチャット内ツールを承認する
- 失敗した ChatToolInvocation を調査する
```

`tool:credential:manage` はさらに強い権限として、SYSTEM_ADMIN または専用ロールに限定します。

------

## 19.16 デバッグ管理者

```text
Role: DEBUG_OPERATOR

permissions:
- debug:trace:read:sanitized
- debug:trace:export
- debug:ingest:read
- debug:chunk:read
- debug:replay
- rag:trace:read:sanitized
- chat_orchestration:trace:read:sanitized
- agent:trace:read:sanitized
- chat_tool:read
```

できること:

```text
- RAG run、ingest run、ChatOrchestrationRun、AsyncAgentRun、tool invocation の sanitize 済み trace を確認する
- 拡張子別の前処理や chunk 結果を確認する
- 図面 metadata の抽出結果を確認する
- 条件を満たす run を replay する
```

制約:

```text
- raw chunk preview は対象フォルダ readOnly 以上が必要
- replay は対象フォルダ full が必要
- internal_restricted trace は SYSTEM_ADMIN または明示付与された担当者に限定
```

------


## 19.17 非同期エージェント利用者

```text
Role: ASYNC_AGENT_USER

permissions:
- agent:run
- agent:cancel
- agent:read:self
- agent:trace:read:self
- agent:artifact:download
- skill:read
- agent_profile:read
- agent_preset:read:self
- agent_preset:create:self
- agent_preset:update:self
- agent_preset:delete:self
```

できること:

```text
- 権限のあるフォルダ / 文書を raw file として使い、非同期エージェントを実行する
- 自分の AsyncAgentRun を確認・キャンセルする
- 成果物をダウンロードする
- 利用可能な skill / agent profile を選択する
- よく使う実行設定をプリセット保存する
```

------

## 19.18 skills / agent profile 管理者

```text
Role: SKILL_AGENT_MANAGER

permissions:
- skill:read
- skill:create
- skill:update
- skill:delete
- skill:share
- skill:generate_with_ai
- agent_profile:read
- agent_profile:create
- agent_profile:update
- agent_profile:delete
- agent_profile:share
- agent_profile:generate_with_ai
```

できること:

```text
- skill Markdown を作成・編集・共有する
- agent profile Markdown を作成・編集・共有する
- AI に draft を作成させ、確認して保存する
- フォルダと同じ階層共有ルールで管理する
```

------

## 19.19 非同期エージェント管理者

```text
Role: ASYNC_AGENT_ADMIN

permissions:
- agent:run
- agent:cancel
- agent:read:managed
- agent:trace:read:sanitized
- agent:artifact:download
- agent:artifact:writeback
- agent:settings:manage
- agent:provider:manage
- skill:read
- agent_profile:read
```

できること:

```text
- 管理対象の AsyncAgentRun を確認・停止する
- provider / model / 実行環境の設定を管理する
- 成果物の writeback を承認する
- 失敗 run を調査する
```

------


## 19.20 ナレッジ品質管理者

```text
Role: KNOWLEDGE_QUALITY_MANAGER

permissions:
- quality:read
- quality:update
- quality:verify
- quality:exclude
- quality:review_request:create
- quality:conflict:detect
- quality:policy:read
- parse:read
```

できること:

```text
- 文書の検証状態、鮮度状態、置き換え状態を確認する
- 文書を検証済みにする
- 文書をRAG対象から除外する
- 文書オーナーへ確認依頼する
- 矛盾候補や旧版候補を確認する
```

## 19.21 文書解析運用者

```text
Role: DOCUMENT_PARSE_OPERATOR

permissions:
- parse:read
- parse:reanalyze
- parse:ocr:rerun
- parse:table:review
- parse:figure:review
- parse:diff:read
- quality:read
```

できること:

```text
- 解析結果を確認する
- 再解析を実行する
- OCRを再実行する
- 表抽出結果をレビューする
- 図説明をレビューする
- 再解析前後の差分を確認する
```

------



## 19.22 API契約管理者

```text
Role: API_CONTRACT_MANAGER

permissions:
- api_contract:read
- api_contract:check
- api_contract:drift:read
- api_contract:docs:generate
- ui_inventory:read
- ui_inventory:generate
```

できること:

```text
- REST / oRPC / OpenAPI の drift を確認する
- OpenAPI docs と UI inventory を生成する
- contract gate の失敗理由を確認する
```

## 19.23 CI/CD運用者

```text
Role: CI_CD_OPERATOR

permissions:
- ci:benchmark:run
- ci:deploy:run
- ci:artifact:read
- ops:deploy:read
- ops:quota:read
- worker:run:read
```

できること:

```text
- GitHub Actions / CDK deploy の実行状況を確認する
- benchmark runner を CI から起動する
- deploy artifact、synth artifact、cdk-nag report を確認する
```

## 19.24 アカウント運用者

```text
Role: ACCOUNT_OPS_OPERATOR

permissions:
- ci:cognito_user:create
- user:read
- user:create
- group:read
- role:read
```

できること:

```text
- UI とは別の運用 workflow から Cognito user を作成する
- ロール名 / グループ名の正規化結果を確認する
- 作成操作の監査ログを確認する
```

## 19.25 Worker運用者

```text
Role: WORKER_OPERATOR

permissions:
- worker:run:read
- worker:run:retry
- worker:run:cancel
- debug:trace:read
- debug:trace:export
```

できること:

```text
- chat / ingest / benchmark / async agent worker の実行状況を確認する
- retry / cancel を行う
- worker trace を権限内で export する
```

# 20. 操作別の最終認可表

## 20.0 この章の整理

この章は一覧表そのものが主目的のため、詳細な業務処理は各機能章を参照します。

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Authorization matrix | 認可表 | 操作ごとに必要な機能権限とリソース権限を対応づけた一覧。 |

### データ
この章では、データ構造ではなく方針・ルールを中心に整理します。


### 守るべきルール
- 認可表は実装、UI制御、監査の共通参照とする。
- 新しい操作を追加した場合は、feature permissionとresource permissionを必ず追記する。

### 実行すべき処理
1. 操作単位で必要権限を確認する。
2. 一覧にない操作が実装された場合は仕様差分として検出する。

### UI
- 管理者向けには操作別に必要権限を確認できる一覧を提供する。

------

| 操作                  | Feature permission            | Resource permission            |
| --------------------- | ----------------------------- | ------------------------------ |
| チャット送信          | `chat:create`                 | 検索対象フォルダ readOnly 以上 |
| 一時添付              | `chat:attachment:create`      | 同一チャットのみ               |
| 履歴閲覧              | `history:read:self`           | 自分のセッション               |
| お気に入り登録        | `favorite:create:self`        | 対象を現在閲覧できる           |
| フォルダ作成 個人     | `folder:create:personal`      | 作成者が管理者                 |
| フォルダ作成 グループ | `folder:create:group`         | 対象グループで full            |
| フォルダ名変更        | `folder:update`               | 対象フォルダ full              |
| フォルダ移動          | `folder:move`                 | 元フォルダ full + 移動先 full  |
| フォルダ削除          | `folder:delete`               | 対象フォルダ full              |
| 共有追加              | `folder:share`                | 対象フォルダ full              |
| 共有削除              | `folder:share`                | 対象フォルダ full              |
| 文書閲覧              | `document:read`               | 所属フォルダ readOnly 以上     |
| 文書DL                | `document:download`           | 所属フォルダ readOnly 以上     |
| 文書アップロード      | `document:upload`             | 対象フォルダ full              |
| 文書削除              | `document:delete`             | 所属フォルダ full              |
| 文書移動              | `document:move`               | 元フォルダ full + 移動先 full  |
| 再インデックス        | `index:rebuild`               | 対象フォルダ full              |
| cutover               | `index:cutover`               | 対象フォルダ full              |
| rollback              | `index:rollback`              | 対象フォルダ full              |
| 検索改善レビュー      | `search_improvement:review`   | 対象 scope の管理権限          |
| 検索改善公開          | `search_improvement:publish`  | 対象 scope の管理権限          |
| benchmark 実行        | `benchmark:run`               | 対象フォルダ readOnly 以上     |
| benchmark 成果物DL    | `benchmark:artifact:download` | 対象 run へのアクセス          |
| 問い合わせ対応        | `support:ticket:read/update`  | 割当済み ticket                |
| ユーザー停止          | `user:suspend`                | 管理対象ユーザー               |
| グループメンバー変更  | `group:membership:update`     | 対象グループ管理権限           |
| ロール付与            | `role:assign`                 | 付与対象ロールの管理権限       |
| 監査ログ閲覧          | `audit:read`                  | ログ閲覧範囲                   |
| 品質プロファイル閲覧  | `quality:read`                | 対象フォルダ readOnly 以上     |
| 品質ステータス更新    | `quality:update`              | 対象フォルダ full              |
| 文書検証              | `quality:verify`              | 対象フォルダ full              |
| RAG対象除外           | `quality:exclude`             | 対象フォルダ full              |
| 文書検証依頼作成      | `quality:review_request:create` | 対象フォルダ readOnly 以上   |
| 解析結果閲覧          | `parse:read`                  | 対象フォルダ readOnly 以上     |
| 再解析                | `parse:reanalyze`             | 対象フォルダ full              |
| OCR再実行             | `parse:ocr:rerun`             | 対象フォルダ full              |
| 表抽出レビュー        | `parse:table:review`          | 対象フォルダ full              |
| 図解析レビュー        | `parse:figure:review`         | 対象フォルダ full              |


追加操作:

| 操作 | Feature permission | Resource permission |
| --- | --- | --- |
| RAG回答生成 | `chat:create` または `rag:run` | 検索対象フォルダ readOnly 以上 |
| sanitize済みRAG trace閲覧 | `rag:trace:read:sanitized` | 対象 run へのアクセス |
| 内部RAG trace閲覧 | `rag:trace:read:internal` | 強権限、監査必須 |
| 非同期 agent 実行 | `agent:run` | 選択フォルダ / 文書 readOnly 以上 + skill / agent profile readOnly 以上 |
| 非同期 agent cancel | `agent:cancel` | 自分の run または管理対象 run |
| チャット内 tool 実行 | `chat_tool:execute` | tool ごとの必要 resource permission |
| チャット内 tool 承認 | `chat_tool:approve` | 承認対象 tool の管理権限 |
| 問い合わせ作成 自分 | `support:ticket:create:self` | 自分の session / message |
| 回答案作成 | `support:draft_answer:create` | 割当済み ticket |
| 回答案送信 | `support:draft_answer:send` | 割当済み ticket + citation 文書 readOnly 以上 |
| 検索改善候補作成 | `search_improvement:suggest` | 対象 scope の閲覧権限 |
| RAG trace 閲覧 | `rag:trace:read:sanitized` | 対象 run へのアクセス + sanitize 済み |
| ingest debug 閲覧 | `debug:ingest:read` | 対象文書 / フォルダ readOnly 以上 |
| chunk preview 閲覧 | `debug:chunk:read` | 対象文書 / フォルダ readOnly 以上 |
| debug trace export | `debug:trace:export` | 対象 trace へのアクセス |
| debug replay | `debug:replay` | 対象フォルダ full |
| 非同期 agent 成果物DL | `agent:artifact:download` | 対象 run へのアクセス |
| 非同期 agent writeback | `agent:artifact:writeback` | 保存先 / 変更先フォルダ full + 明示承認 |
| skill 作成 | `skill:create` | 対象 skill folder full |
| skill 共有 | `skill:share` | 対象 skill folder full |
| agent profile 作成 | `agent_profile:create` | 対象 agent profile folder full |
| agent profile 共有 | `agent_profile:share` | 対象 agent profile folder full |
| agent preset 作成 | `agent_preset:create:self` | 自分の preset |
| 個人設定更新 | `settings:update:self` | 自分の設定 |
| パスワード変更 | `auth:password:update:self` | 自分の account |
| アカウント削除 自分 | `account:delete:self` | 自分の account + 削除条件確認 |
| アカウント削除 管理 | `account:delete:managed` | 管理対象 account + 影響確認 |

------

回答生成詳細追加操作:

| 操作 | Feature permission | Resource permission |
| --- | --- | --- |
| 回答生成 policy 閲覧 | `rag:answer_policy:read` | 対象 environment / project の参照権限 |
| 回答生成 policy 更新 | `rag:answer_policy:update` | 管理対象 environment + 監査理由 |
| context policy 更新 | `rag:context_policy:update` | 管理対象 environment + benchmark gate |
| answerability trace 閲覧 | `debug:answer_generation:read` | 対象 run へのアクセス + sanitize 済み |
| usedSpans / computedFacts export | `debug:answer_generation:export` | 対象 run へのアクセス + export 権限 |
| benchmark回答policy利用 | `rag:benchmark_answer_policy:use` | benchmark runner / suite 実行権限 |



開発・運用追加操作:

| 操作 | Feature permission | Resource permission |
| --- | --- | --- |
| OpenAPI JSON閲覧 | なし、または `api_contract:read` | public endpoint は非機微情報のみ |
| API drift check 実行 | `api_contract:check` | repository / environment の実行権限 |
| OpenAPI docs生成 | `api_contract:docs:generate` | repository 書き込み権限なしでも可 |
| OpenAPI docs更新PR作成 | `api_contract:docs:publish_pr` | repository PR 作成権限 + GitHub token |
| UI inventory生成 | `ui_inventory:generate` | repository 読み取り権限 |
| GitHub Actions deploy | `ci:deploy:run` | 対象 environment approval + AWS OIDC role |
| deploy artifact閲覧 | `ci:artifact:read` | 対象 workflow / environment の閲覧権限 |
| Cognito user作成 workflow | `ci:cognito_user:create` | 対象 user / role / group の管理権限 + 環境承認 |
| GitHub Actions benchmark起動 | `ci:benchmark:run` | benchmark suite 実行権限 + runner secret |
| benchmark runner secret解決 | service permission | Secrets Manager secret read、ログ秘匿 |
| API Gateway quota確認 | `ops:quota:read` | 対象 AWS account / region の参照権限 |
| worker retry | `worker:run:retry` | 対象 run への運用権限 |
| worker cancel | `worker:run:cancel` | 対象 run への運用権限 |
| local mock mode利用 | `ops:local_mode:read` または開発者権限 | 本番 secret なし |

# 21. RAG 認可の不変条件

## 21.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Invariant | 不変条件 | 設計や実装が変わっても常に守るべき条件。 |
| Authorized and quality-approved evidence | 認可済みかつ品質承認済み根拠 | ユーザーが読め、品質ポリシーにも通過した根拠。RAG回答で使える最終条件。 |

### データ
この章では、データ構造ではなく方針・ルールを中心に整理します。


### 守るべきルール
- LLMに権限判断を任せない。
- mode=allはユーザーが閲覧可能な全資料であり、全社の全資料ではない。
- citationに権限外文書を含めない。
- computedFactsにもsupportingEvidenceIdsを持たせ、権限外根拠を使わない。
- memory summaryを最終citationにしない。

### 実行すべき処理
1. 認証、機能権限、検索範囲正規化、リソース権限、品質フィルタを順に実行する。
2. 検索後にもmanifest、folder permission、quality policyを再確認する。
3. authorized and quality-approved evidenceのみLLMに渡す。

### UI
- 利用者には安全な回答範囲とcitationだけを表示する。
- debug traceもsanitizeして、権限外文書や内部policyを出さない。

------

RAG 検索では、LLM に権限判断を任せません。

必須フローは次です。

```text
1. 認証
2. feature permission 確認
3. searchScope 正規化
4. 対象 folder / document / temporaryScope の resource permission 確認
5. active 文書だけに絞る
6. quality policy で RAG利用可能文書に絞る
7. freshness / verification / supersession / extraction quality を確認する
8. lexical search
9. semantic vector search
10. vector hit を manifest / folder permission / quality profile で再確認
11. fusion / rerank
12. answerability_gate / sufficient_context_gate で RequiredFact の支持状況を確認する
13. final answer context selection で minScore filter と品質 gate を通す
14. authorized and quality-approved evidence と computedFacts のみ LLM に渡す
15. citation も authorized and quality-approved document のみ返す
16. verify_answer_support を通過しない unsupported answer を返さない
17. debug trace を sanitize する
```

不変条件:

```text
- mode=all は「全社の全資料」ではない
- mode=all は「ユーザーが閲覧可能な全資料」ではなく「閲覧可能かつ quality-approved な資料」
- readOnly 未満の文書は検索対象外
- active でも ragEligibility = excluded の文書は検索対象外
- expired / superseded / rejected は通常回答の根拠にしない
- OCR / 表 / 図 / レイアウト解析が低信頼な箇所だけを根拠に断定しない
- 権限外文書の存在を示唆しない
- 共有解除は再インデックスなしで即時反映
- 品質ステータス変更は embedding 再計算なしで即時反映
- citation に権限外文書、または品質ポリシーで禁止された文書を含めない
- answer span は citation より細かい grounding 情報であり、権限・品質を通過した evidence に限る
- computedFacts は文書根拠と supportingEvidenceIds を持つ場合のみ回答根拠にできる
- memory summary や assistant の過去発話を final citation として使わない
- unsupported sentence が残る回答は返さない
```



チャット内ツールを含む場合も、不変条件は変わりません。

```text
- ChatOrchestrationRun はユーザー権限を超えない
- チャット内 tool 実行前に feature permission と resource permission を確認する
- tool 出力は untrusted data として検証する
- 外部 tool に送る情報は最小化する
- 回答不能時に権限外文書の存在を示唆しない
- 担当者に渡す trace は sanitize する
- ツール出力を evidence として使う場合は schema validation と support verification を通す

非同期エージェントの不変条件:
- AsyncAgentRun は選択された raw file だけを workspace に mount する
- mount 前に resource permission を確認する
- readOnly mount は元ファイルに書き戻せない
- writeback は full 権限と明示承認を必須にする
- skill / agent profile は利用時に readOnly 以上を確認する
- プリセット内リソースも実行時に再認可する
- workspace、log、artifact に権限外情報を混ぜない
```

------


# 21A. API lifecycle と互換性の不変条件

## 21A.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| API lifecycle | APIライフサイクル | APIの追加、変更、非推奨化、削除、ドキュメント同期までの運用過程。 |
| Deprecated endpoint | 非推奨API | 互換性のため一時的に残すが、新規利用を推奨しないAPI。 |
| Breaking change | 破壊的変更 | 既存利用者やUIがそのままでは動かなくなるAPI変更。 |

### データ
この章では、データ構造ではなく方針・ルールを中心に整理します。


### 守るべきルール
- 互換性を壊す変更はdrift gateとレビューで止める。
- 後方互換同期APIは用途と非推奨理由を明記する。
- OpenAPI docsとUI inventoryを同期し、仕様と実装の乖離を放置しない。

### 実行すべき処理
1. API変更時にcontract test、OpenAPI生成、docs生成、UI inventoryを実行する。
2. 破壊的変更を検出した場合は承認フローへ回す。
3. 非推奨APIの利用状況を監視する。

### UI
- API管理画面に変更履歴、drift結果、非推奨API、破壊的変更候補を表示する。

------

API は、利用者向け UI、非同期 worker、benchmark runner、GitHub Actions workflow、外部連携から利用されるため、互換性と安全性を明示します。

```text
- GET /openapi.json は runtime contract の source of truth。
- 生成 Markdown は派生成果物であり、手編集した内容を正本にしない。
- REST と oRPC の schema drift は CI で検出する。
- compatibility endpoint は残せるが、大容量・長時間用途では非推奨とする。
- public endpoint は非機微情報のみを返す。
- protected endpoint は user status + feature permission + resource permission を必ず確認する。
- API error は権限外 resource の存在を示唆しない。
- streaming / SSE でも run access permission を確認する。
```

------

# 22. 危険操作の共通要件

## 22.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Dangerous operation | 危険操作 | 削除、移動、ロール付与、公開、cutover、writebackなど影響が大きい操作。 |
| Impact preview | 影響プレビュー | 実行前に影響ユーザー数、文書数、権限変更、公開範囲などを表示すること。 |
| Double submit prevention | 二重実行防止 | 同じ危険操作が連続実行されないようにする仕組み。 |

### データ
この章では、データ構造ではなく方針・ルールを中心に整理します。


### 守るべきルール
- 危険操作では操作名、対象、変更前、変更後、影響、理由入力を表示する。
- async/busy表示、二重実行防止、focus trap、return focusを守る。
- 成功・失敗を明示し、監査ログに記録する。

### 実行すべき処理
1. 危険操作の実行前に影響を計算する。
2. 理由入力と確認を受けてから実行する。
3. 失敗時は原因とリトライ可否を返す。
4. 実行結果を監査ログへ保存する。

### UI
- 危険操作ダイアログを共通化し、操作名、対象、変更前後、影響件数、理由入力、実行ボタンを表示する。
- キーボード操作とアクセシビリティを満たす。

------

次はすべて危険操作です。

```text
- フォルダ削除
- フォルダ移動
- フォルダ管理者変更
- 個別共有設定作成
- 個別共有設定削除
- full 権限者削除
- 共有全解除
- 文書削除
- 再インデックス
- 再解析
- OCR再実行
- 表抽出レビュー
- 図解析レビュー
- cutover
- rollback
- 品質ステータス変更
- 文書検証
- RAG対象除外 / 復帰
- 検索改善の公開
- ロール付与
- ロール剥奪
- ユーザー停止
- グループ削除
- アカウント削除
- 非同期エージェントの writeback
- 非同期エージェントの外部送信
- skill / agent profile の共有設定変更
- agent provider / model の有効化・無効化
```

共通 UI:

```text
危険操作ダイアログ
  ├─ 操作名
  ├─ 対象
  ├─ 変更前
  ├─ 変更後
  ├─ 影響ユーザー数
  ├─ 影響文書数
  ├─ 理由入力
  └─ 実行
```

必須挙動:

```text
- async / busy 表示
- 二重実行防止
- Escape 対応
- focus trap
- return focus
- 失敗時の明示
- 成功時の明示
- 監査ログ記録
```

------

# 23. 推奨 URL 構成

## 23.0 この章の整理

この章はURL一覧が主目的のため、業務データ定義は持ちません。

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| URL structure | URL構成 | 画面やAPIの場所を一貫して表すパス設計。 |
| Route | ルート | 特定の画面や機能に対応するURLパス。 |

### データ
この章では、データ構造ではなく方針・ルールを中心に整理します。


### 守るべきルール
- URLは機能領域ごとに一貫した階層にする。
- 詳細画面は対象IDを含める。
- 管理系、ユーザー向け、開発運用系のURLを混ぜすぎない。

### 実行すべき処理
1. 機能追加時に推奨URLへ画面を割り当てる。
2. 画面遷移、権限制御、パンくず表示とURLを対応させる。

### UI
- URLから利用者が機能領域を理解できるようにする。
- 権限不足時は安全なエラーまたはアクセス可能な一覧へ戻す。

------

```text
/login
/signup
/forgot-password
/reset-password
/settings
/settings/account
/settings/preferences

/chat
/chat/:sessionId

/history
/favorites

/documents
/documents/folders/:folderId
/documents/:documentId
/documents/ingest-runs
/documents/ingest-runs/:runId
/documents/reindex-runs/:runId

/agents
/agents/runs
/agents/runs/:agentRunId
/agents/presets
/agents/skills
/agents/skills/:skillId
/agents/profiles
/agents/profiles/:agentProfileId

/support
/support/:ticketId

/search-improvement
/search-improvement/candidates
/search-improvement/mappings/:mappingId
/search-improvement/tests

/benchmarks
/benchmarks/suites/:suiteId
/benchmarks/runs/:runId

/admin
/admin/users
/admin/users/:userId
/admin/groups
/admin/groups/:groupId
/admin/roles
/admin/usage
/admin/costs
/admin/audit-log
/admin/quality
/admin/parse-quality
/admin/debug
/admin/debug/rag-runs/:ragRunId
/admin/debug/ingest-runs/:ingestRunId
/admin/debug/chat-orchestration-runs/:orchestrationRunId
/admin/debug/async-agent-runs/:agentRunId
/admin/debug/tool-invocations/:invocationId
/admin/agents/providers
/admin/agents/runs/:agentRunId

/health
/openapi.json
/rpc

/admin/api-contracts
/admin/api-contracts/drift
/admin/api-contracts/openapi
/admin/ui-inventory
/admin/deploys
/admin/deploys/:deployRunId
/admin/workers
/admin/workers/:workerRunId
/admin/benchmarks/runner-runs/:runnerRunId
```

------

# 23A. 簡易処理フロー

## 23A.0 この章の整理

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Processing flow | 処理フロー | 利用者操作または運用操作から、システム内部処理、結果表示までの流れ。 |
| Run | 実行単位 | 取り込み、RAG、benchmark、agent、workerなど、状態を持って進む処理。 |

### データ
この章では、データ構造ではなく方針・ルールを中心に整理します。


### 守るべきルール
- 処理フローは非技術者にも分かる粒度で箇条書きにする。
- 詳細なデータ項目は各章のデータ表を参照する。
- 権限・品質・監査の確認ポイントを省略しない。

### 実行すべき処理
1. アップロード、図面処理、品質ゲート、RAG回答、回答不能、ツール実行、非同期エージェント、ベンチマーク、CI/CDを流れとして整理する。
2. 各フローの開始条件、主要処理、終了状態、UI表示を明記する。

### UI
- フローは管理者が運用判断に使えるよう、画面名やボタン導線と対応させる。

------

この章は、IF、UI、権限の詳細とは別に、実処理の流れを確認するための簡易フローです。

## 23A.1 ファイルアップロードから RAG 検索対象化まで

```text
1. ユーザーがフォルダを選択する。
2. feature permission と対象フォルダ full を確認する。
3. ファイル拡張子、MIME、サイズ、暗号化状態を検証する。
4. Document を uploaded として作成する。
5. IngestRun を queued として作成する。
6. 拡張子別の前処理を行う。
7. テキスト、表、画像OCR、図面 metadata などを抽出する。
8. 拡張子別ルールで chunk を作成する。
9. chunk 品質チェックを行う。
10. embedding を作成する。
11. indexVersion に紐づけて検索 index へ登録する。
12. Document を active にする。
13. ingest debug trace と監査ログを残す。
```

## 23A.2 図面系ファイルの処理フロー

```text
1. .dwg / .dxf / .ifc / .rvt / .rfa / .svg / .step 等の拡張子を判定する。
2. 変換器が必要な拡張子では、変換器の有効性を確認する。
3. layout、sheet、layer、block、entity、title block、注記、寸法文字を抽出する。
4. 必要に応じて図面を画像化し、OCR する。
5. drawingNumber、drawingTitle、revision、scale、units、bbox、layerNames などを metadata 化する。
6. タイトルブロック、一般注記、表、layer summary、BIM entity group を chunk 化する。
7. 図面 metadata の信頼度を debug trace に保存する。
8. 検索 index には chunk と metadata filter 用情報を登録する。
```


## 23A.2A ナレッジ品質・解析品質ゲートフロー

```text
1. IngestRun が抽出 / チャンク化 / embedding を完了する。
2. ParsedDocument、ExtractedTable、ExtractedFigure、DocumentChunk を作成する。
3. chunk 数、tokenCount、citation 参照、page / table / figure 参照を検証する。
4. OCR信頼度、表抽出信頼度、図解析信頼度、読み順信頼度を評価する。
5. DocumentQualityProfile を作成または更新する。
6. verification / freshness / supersession / extractionQualityStatus を決定する。
7. ragEligibility を決定する。
8. 品質ゲート合格なら active 化する。
9. 品質ゲート不合格なら failed または needs_human_review にする。
10. 管理ダッシュボードに未検証、期限切れ、解析要確認を表示する。
```

## 23A.3 チャット / RAG / ツール回答フロー

```text
1. ユーザーが質問、回答範囲、モデルを指定する。
2. chat:create と回答範囲の readOnly 以上を確認する。
3. ChatOrchestrationRun と RagQueryRun を作成する。
4. ConversationState を読み込み、直近発話、圧縮 summary、previous citation、memory card を分ける。
5. assistant の refusal 文・定型文を active topic から除外する。
6. decontextualize_query で standalone question と retrieval queries を作る。
7. question requirement slot を検出する。
8. structured_fact_planning で RequiredFact を作る。
9. searchScope を正規化する。
10. active 文書に絞る。
11. quality policy で RAG利用可能文書に絞る。
12. freshness / verification / supersession / extraction quality を確認する。
13. query rewrite / expansion を行う。
14. lexical search と semantic search を実行する。
15. previous citation anchor と memory sourceChunkIds を再認可して検索 clue として使う。
16. 検索ヒットを manifest / folder permission / quality profile で再確認する。
17. fusion / rerank を行う。
18. retrieval evaluator で RequiredFact coverage、riskSignals、claim conflict 候補を評価する。
19. answerability_gate / sufficient_context_gate で ANSWERABLE / PARTIAL / UNANSWERABLE を判定する。
20. PARTIAL の場合、primary fact の supported / missing / conflicting を見て継続可否を決める。
21. final answer context selection で minScore filter、diversity、high-confidence early stop を適用する。
22. 必要に応じて document / drawing / support / debug / quality / parse / computed fact tool を実行する。
23. tool output を schema validation し、sanitize する。
24. authorized and quality-approved evidence、computedFacts、tool output summary のみ LLM に渡す。
25. extractive-first / source wording 優先で回答を生成する。
26. validate_citations で citation と質問要求 slot を検証する。
27. verify_answer_support で回答文ごとの支持を検証する。
28. unsupported sentence がある場合は supported-only answer repair を実行し、再検証する。
29. 回答、citation、usedSpans、computedFacts、quality warning、または answer_unavailable を返す。
30. RAG debug trace と ChatOrchestrationRun trace を sanitize して保存する。
```

## 23A.4 回答不能から担当者対応まで

```text
1. RAG が no_search_results / insufficient_evidence 等を判定する。
2. 利用者向けの回答不能メッセージを生成する。
3. 画面に「質問を言い換える」「回答範囲を変更」「担当者に確認する」を表示する。
4. 利用者が担当者確認を選ぶ。
5. support.ticket.create tool の実行内容を利用者に確認させる。
6. SupportTicket を作成する。
7. sanitized diagnostics を担当者に渡す。
8. 担当者が調査し、回答案または検索改善候補を作成する。
9. 対応完了時にメモ、回答、改善結果を保存する。
10. 監査ログを残す。
```

## 23A.5 チャット内オーケストレーション / ツール実行フロー

```text
1. ChatOrchestrationRun を作成する。
2. orchestration mode と利用可能 tool を確定する。
3. 実行ユーザーの feature permission を確認する。
4. tool ごとの requiredFeaturePermission を確認する。
5. 対象 resource permission を確認する。
6. 危険操作または外部送信なら人間承認を待つ。
7. ChatToolInvocation を実行する。
8. tool 出力を schema validation し、sanitize する。
9. 必要な場合だけ LLM に tool output summary を渡す。
10. 利用者には実行した手順と結果を表示する。
11. debug trace と監査ログを残す。
```

## 23A.6 デバッグ確認フロー

```text
1. 運用者が runId、ticketId、documentId などから debug 画面を開く。
2. debug 権限と対象 resource permission を確認する。
3. DebugTrace を表示レベルに応じて sanitize する。
4. ingest / RAG / agent / tool の step、件数、latency、warning、error を表示する。
5. 必要に応じて chunk preview、図面 metadata、検索結果差分を見る。
6. export または replay が必要な場合は追加権限と承認を確認する。
7. debug 閲覧、export、replay を監査ログに記録する。
```

------

## 23A.7 非同期エージェント実行フロー

```text
1. ユーザーが非同期エージェント実行画面を開く。
2. provider、model、実行指示、対象フォルダ / ファイル、skills、agent profile を選ぶ。
3. お気に入りプリセットがある場合は初期値として読み込む。
4. agent:run と対象 resource permission を確認する。
5. skill / agent profile の readOnly 以上を確認する。
6. AsyncAgentRun を queued として作成する。
7. workspace を作成する。
8. 選択された original file を readOnly mount または writableCopy として配置する。
9. 選択された skill / agent profile Markdown をフラットなリストで workspace に渡す。
10. provider adapter が Claude Code / Codex / OpenCode / custom を起動する。
11. progress log、cost、artifact を収集する。
12. 完了後、成果物を run artifact として保存する。
13. 必要に応じて利用者が成果物をダウンロードする。
14. フォルダへ保存または writeback する場合は、対象 full と明示承認を確認する。
15. audit log と debug trace を保存する。
```

## 23A.8 skill / agent profile 作成フロー

```text
1. ユーザーが skill または agent profile 作成画面を開く。
2. 手動作成、Markdownアップロード、AI作成のどれかを選ぶ。
3. AI作成の場合、チャット形式で目的、対象業務、制約、出力形式を入力する。
4. AI が Markdown draft を生成する。
5. 利用者が内容を確認・編集する。
6. 危険な指示、秘密情報要求、権限昇格指示を検査する。
7. 保存先 folder の full 権限を確認する。
8. draft または active として保存する。
9. 必要に応じてフォルダ共有と同じ UI で共有設定する。
10. 実行時には選択された Markdown をフラットに展開して AsyncAgentRun に渡す。
```

## 23A.9 ベンチマークパイプラインフロー

```text
1. benchmark suite と useCase を選ぶ。
2. baseline config と candidate config を設定する。
3. 対象フォルダ / 文書への readOnly 以上を確認する。
4. 権限 fixture を作り、権限あり / なしケースを確認する。
5. 必要に応じて ingest / reindex を実行する。
6. retrieval_eval で recall@k、MRR、nDCG を測る。
7. answer_eval で正答性、faithfulness、answer_unavailable 判定を測る。
8. answerability_gate_eval で RequiredFact、primary fact、PARTIAL 継続条件、false refusal / false answer を測る。
9. support_verification_eval で unsupported sentence と supported-only repair 成功率を測る。
10. computed_fact_eval で日付・金額・閾値条件の計算妥当性を測る。
11. claim_conflict_eval で typed claim、value mismatch、scope-different no-conflict を測る。
12. context_selection_eval で minScore filter、high-confidence early stop、memory grounding を測る。
13. citation_eval で citation precision / recall、page accuracy、usedSpan accuracy を測る。
14. multiturn_eval で decontextualized query、previous citation anchoring、refusal filtering、会話圧縮、文脈追従を測る。
15. drawing_metadata_eval で図面番号、改訂、尺度、layer、bbox を測る。
16. long_context_eval で 500P超PDFのページ・章節・親子chunk検索を測る。
17. async_agent_eval で raw file mount、skill / agent profile、成果物品質を測る。
18. cost_latency_eval で p50 / p95、token、cost を測る。
19. baseline と candidate の差分を出す。
20. promotionGate の合否を判定する。
21. 失敗ケースから検索改善、文書検証、再解析、OCR再実行、表レビュー、chunker改善、prompt改善、answer policy 改善、context policy 改善、skill改善へ遷移する。
```

------


## 23A.10 API契約・OpenAPI docs 同期フロー

```text
1. shared contract を build する。
2. REST route と oRPC procedure を収集する。
3. OpenAPI JSON を生成する。
4. REST / oRPC / OpenAPI の schema drift を確認する。
5. operation summary / description、field description を検査する。
6. OpenAPI Markdown を生成する。
7. docs/generated と差分がある場合、GitHub Actions が更新 PR を作る。
8. drift または docs quality gate の失敗時は CI を失敗させる。
```

## 23A.11 UI inventory 自動生成フロー

```text
1. Web app の route、component、permission guard、action label を静的解析する。
2. 画面、機能、操作要素を inventory item に変換する。
3. certainty を confirmed / inferred / unknown に分類する。
4. docs/generated/web-features.md 等に出力する。
5. 仕様書に存在しない画面や、実装されていない仕様を差分として確認する。
```

## 23A.12 GitHub Actions / CDK deploy フロー

```text
1. workflow_dispatch または protected branch push で deploy を開始する。
2. environment approval を確認する。
3. GitHub OIDC で AWS Role を assume する。
4. test、contract check、docs check、web inventory check を実行する。
5. CDK synth と cdk-nag を実行する。
6. synth artifact、CloudFormation template、cdk-nag report を保存する。
7. CDK deploy を実行する。
8. deploy outputs を保存する。
9. /health と /openapi.json に対して smoke test を実行する。
```

## 23A.13 GitHub Actions からの Cognito user 作成フロー

```text
1. 運用者が workflow_dispatch で email、displayName、role、group、environment を入力する。
2. environment approval を確認する。
3. OIDC で AWS Role を assume する。
4. 入力 role を Cognito group 名へ正規化する。
5. Cognito User Pool に user を作成する。
6. 招待メールまたは初期パスワード設定フローを開始する。
7. 操作結果、実行者、対象 user、付与 group / role を監査ログに残す。
```

## 23A.14 CI / Ops 起点 benchmark runner フロー

```text
1. GitHub Actions で suite、targetConfig、environment を指定する。
2. benchmark runner secret を解決する。
3. suite corpus を初期化する。
4. 外部 dataset が必要な場合は取得・変換する。
5. corpus をアップロードし、ingest 完了と active chunk を確認する。
6. 抽出不能文書を skipped_unextractable として記録する。
7. POST /benchmark-runs を呼ぶ。
8. Step Functions + CodeBuild runner が benchmark を実行する。
9. status を polling し、timeout / failed / completed を判定する。
10. metrics、skip manifest、latency、artifact link を保存する。
```

## 23A.15 非同期 worker 実行フロー

```text
1. API が ChatRun / IngestRun / BenchmarkRun / AsyncAgentRun を queued として作成する。
2. worker event に runId を入れて Lambda / Step Functions / CodeBuild を起動する。
3. worker が runId を検証する。
4. 対象 run、tenant、実行権限、resource permission を再確認する。
5. executor を実行する。
6. 進捗 event を保存し、必要に応じて SSE で配信する。
7. completed / failed / cancelled を run に保存する。
8. retry 可能エラーは retry policy に従い、retry 不可エラーは failed とする。
```

------

# 24. 最終まとめ

## 24.0 この章の整理

この章は全体の要約であり、新しい業務処理を定義する章ではありません。

### 定義
| 英名 | 日本語名 | 説明 |
|---|---|---|
| Operating principle | 運用原則 | 機能、権限、品質、監査、改善を統一的に扱うための最終方針。 |

### データ
この章では、データ構造ではなく方針・ルールを中心に整理します。


### 守るべきルール
- RAG回答はauthorized evidenceかつquality-approved evidenceだけを根拠にする。
- チャット内オーケストレーションと非同期エージェント実行を分ける。
- 品質・解析・回答生成・ベンチマーク・運用は改善ループとして接続する。

### 実行すべき処理
1. 全体仕様を章ごとに確認し、運用上の責任者、必要権限、UI、受け入れ条件を確認する。
2. 未実装・計画・open questionはロードマップで管理する。

### UI
- 全体管理者向けには、機能ごとの責任範囲と要対応状態を管理ダッシュボードに集約する。

------

今回の仕様では、全体を次のように定義します。

```text
チャット:
閲覧可能な資料を回答範囲として質問する。
回答範囲は常時表示する。
回答生成では RequiredFact、Sufficient Context Gate、citation validation、Answer Support Verifier、supported-only answer repair、computedFacts を使い、根拠不足時は推測回答しない。
マルチターンでは decontextualized query、previous citation anchoring、memory grounding を使い、履歴や memory summary を最終 citation と混同しない。

履歴:
自分の会話だけを再開・管理する。
他人の履歴は見えない。

お気に入り:
会話、回答、フォルダ、文書を自分用に保存する。
権限を失った対象は開けない。

フォルダ管理:
管理者は個人またはグループ。
パスは管理者ごとに一意。
共有設定は階層継承し、深い階層の個別設定が優先。

文書管理:
active は RAG 利用の必要条件だが十分条件ではない。
アップロード、削除、移動、再インデックスは対象フォルダ full が必要。

検索改善:
AI が候補を出し、人間が確認して検索に反映する。
alias という表記は UI に出さない。

ベンチマーク:
ジョブ実行ではなく品質判断の画面。
対象フォルダに readOnly 以上が必要。
回答可否、RequiredFact、support verification、answer repair、computedFacts、claim conflict も品質ゲート対象にする。

管理機能:
ダッシュボード、ユーザー、グループ、ロール、監査、コストを分ける。
危険操作は差分・影響・理由を必須にする。

アカウント・認証:
ログイン、アカウント作成、パスワード再設定、アカウント削除を扱う。
アカウント削除やパスワード変更は監査・通知・session revoke を伴う。

個人設定:
チャット送信方法、既定モデル、既定回答範囲、非同期エージェントの既定 provider / model、通知、表示を保存する。
ただし、個人設定は権限を拡張しない。

チャット内オーケストレーション:
RAG検索、回答生成、チャット内ツール実行、回答不能判定をチャット内部の処理として扱う。
旧「エージェント」はこの名称へ変更する。

非同期エージェント実行:
Claude Code / Codex / OpenCode / custom を provider として選び、モデルを選択して非同期に実行する。
共有フォルダ内のファイルは chunk ではなく original file として workspace に mount する。

skills / agent profile:
Markdown として作成・編集・共有できる。
作成画面で手動作成でき、チャット形式で AI に draft を作らせることもできる。
共有はフォルダと同じ階層継承ルールで扱い、実行時にはフラットに展開する。

エージェントお気に入り:
provider、model、対象フォルダ、skills、agent profile、予算、timeout の組み合わせを複数プリセットとして保持できる。
プリセット内リソースへの権限は実行時に再確認する。

マルチターンチャット:
全履歴をそのまま投入せず、直近 raw message、rolling summary、query-focused summary、citation memory、task state に分ける。
圧縮 summary に権限外情報や内部推論を保存しない。

ベンチマーク:
マルチターンチャット、設計業界の図面、社内相談QA、500P超PDF、非同期エージェントを useCase として明示する。
retrieval、answer、answerability、support verification、answer repair、computedFacts、claim conflict、citation、multiturn、drawing metadata、long context、async agent、cost / latency を pipeline で評価する。
benchmark corpus / runner では benchmark_grounded_short を使い、通常利用者向け回答 policy と分ける。

チャンク化:
対象拡張子を明示し、拡張子ごとに前処理、抽出、chunk 単位、metadata を変える。
PDF、Office、表計算、画像、図面、BIM / CAD は同じ処理にしない。

図面系:
図面番号、改訂、尺度、単位、layer、block、bbox、title block、IFC entity などを metadata として扱う。

ナレッジ品質:
verificationStatus、freshnessStatus、supersessionStatus、ragEligibility を持たせ、未検証・期限切れ・旧版・RAG除外の文書を制御する。
高リスクカテゴリでは、検証済み、文書オーナー、レビュー期限を必須にする。

高度文書解析:
PDF、表、図、画像、OCR、レイアウトを構造化抽出し、ParsedDocument、ParsedBlock、ExtractedTable、ExtractedFigure として保存する。
OCR低信頼、表抽出低信頼、図解析不確実な箇所は、回答根拠として使わない、または警告付きにする。

ツール:
rag.search、document.get_chunks、drawing.list_layers、support.ticket.create、search_improvement.test、benchmark.run、debug.trace.get などを明示的な toolId として管理する。

デバッグ:
run ごとの trace を保存し、user_safe / support_sanitized / operator_sanitized / internal_restricted に分けて表示する。
権限外情報と LLM の内部推論は表示しない。

処理フロー:
アップロード、図面処理、品質ゲート、RAG回答、回答不能、エージェント、デバッグの基本フローを明示する。

API契約:
REST、oRPC、OpenAPI、shared contract、生成 docs を分け、GET /openapi.json を runtime source of truth とする。
API drift と docs quality gate は CI で検出する。

開発品質ゲート:
OpenAPI docs 自動生成、UI inventory 静的解析、Taskfile による verify を使い、仕様・実装・ドキュメントの乖離を検出する。

デプロイ・リリース:
GitHub Actions、OIDC、CDK、cdk-nag、CloudFormation artifact、environment approval を使う。
本番 secret や長期 AWS key を repository に保存しない。

ローカル検証:
MOCK_BEDROCK、USE_LOCAL_VECTOR_STORE、VITE_AUTH_MODE=local などで AWS 非接続の検証を可能にする。
ただし、mock 結果を本番 benchmark の品質判断に使わない。

ベンチマーク運用:
CodeBuild runner、service user、Secrets Manager、corpus seed lifecycle、外部 dataset prepare、skip manifest、metadata budget policy を明示する。

API共通処理:
CORS、public endpoint、auth middleware、SSE / Last-Event-ID、worker handler の runId 契約を明示する。
```

全体権限は、次の原則に統一します。

```text
操作できるか =
ユーザーが active
+ feature permission を持つ
+ 対象 resource に必要な permission を持つ
```

ナレッジ品質と高度文書解析については、次の原則に統一します。

```text
RAG回答に使える根拠 =
ユーザーが閲覧可能
+ active
+ ragEligible
+ verified / current などポリシーを満たす
+ 解析品質が基準を満たす
+ citation可能
```

フォルダ・文書・RAG検索については、最終的にこの一文で定義できます。

```text
RAG検索対象 =
指定された回答範囲
∩ ユーザーが readOnly 以上を持つフォルダ
∩ active な文書
∩ ragEligibility が許可状態
∩ verified / current など品質ポリシーを満たす
∩ OCR / 表 / 図 / レイアウトの解析品質が基準を満たす
∩ citation 可能

RAG回答として返せるもの =
authorized and quality-approved evidence
+ source chunk に展開済みの memory clue
+ supportingEvidenceIds を持つ computedFacts
+ RequiredFact / support verification を通過した回答文
+ 権限内 citation / usedSpans
```

この定義を中心にすれば、チャット、RAG、チャット内オーケストレーション、非同期エージェント、履歴、お気に入り、ベンチマーク、管理機能、フォルダ共有、ナレッジ品質、文書解析品質が同じ権限モデルで扱えるようになります。


追加で、次を明示します。

```text
RAG機能:
閲覧可能で active かつ quality-approved な文書だけを検索し、authorized and quality-approved evidence だけを LLM に渡す。
根拠が不足する場合や、品質条件を満たさない場合は answer_unavailable とする。

チャンク化:
文書を検索可能な chunk に分割するが、認可は folder / document 単位で行う。
chunkerVersion、embeddingModelId、indexVersion を追跡する。

チャット内オーケストレーション:
RAG検索、問い合わせ作成、検索改善候補作成などを支援する。
ただし、実行ユーザーの feature / resource permission を超えない。

非同期エージェント機能:
Claude Code / Codex / OpenCode / custom を非同期に起動し、raw file、skills、agent profile を使って作業する。
ただし、mount、成果物DL、writeback はすべて feature / resource permission を確認する。

ツール:
tool 実行は ToolDefinition に基づいて認可し、危険操作は承認必須にする。
ツール出力は信頼せず、検証・sanitize してから利用する。

回答不能時の担当者対応:
根拠不足、検索失敗、低評価、品質起因の回答不能、手動依頼から SupportTicket を作成できる。
担当者には sanitize 済み情報だけを渡し、検索改善、文書検証、再解析、OCR再実行、表レビュー、RAG除外へつなげる。
```


開発・運用・CI/CD については、次を明示します。

```text
API契約:
REST / oRPC / OpenAPI / shared contract の drift を検出し、GET /openapi.json を runtime source of truth とする。
生成 Markdown は派生成果物として扱う。

OpenAPI docs:
operation summary / description、field description の不足を quality gate で検出し、差分があれば GitHub Actions が更新 PR を作る。

UI inventory:
Web UI の route、component、permission、action を静的解析し、confirmed / inferred / unknown の certainty を付けて generated docs に出力する。

Deploy:
GitHub Actions は OIDC で AWS Role を assume し、CDK synth、cdk-nag、CloudFormation artifact、deploy outputs、smoke test を扱う。

Benchmark runner:
Secrets Manager の service credential、BENCHMARK_RUNNER ACL、corpus seed isolation、external dataset prepare、skipped_unextractable、metadata budget を扱う。

Worker:
chat、ingest、benchmark、async agent は runId を契約にした非同期 worker で実行できる。
```
