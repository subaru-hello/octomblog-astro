---
title: Kubernetes サプライチェーンセキュリティ
category: "概念"
emoji: "🔗"
order: 905
date: "2026-04-09"
series: [Kubernetesセキュリティ]
tags: ["セキュリティ", "Kubernetes", "サプライチェーン", "cosign", "SBOM", "Admission Controller", "Trivy"]
source: "SLSA Framework（slsa.dev）/ Sigstore Documentation（docs.sigstore.dev）/ Trivy Documentation（aquasecurity.github.io/trivy）/ NIST SP 800-161r1（Cybersecurity Supply Chain Risk Management）/ Google Cloud『Binary Authorization』ドキュメント"
---

## サプライチェーン攻撃とは

**ソフトウェアのビルド・配布・デプロイのパイプラインそのものを攻撃し、成果物にバックドアを混入させる手法。**

```
【通常の攻撃】
  攻撃者 → アプリケーションの脆弱性を狙う

【サプライチェーン攻撃】
  攻撃者 → ビルドパイプライン / ライブラリ / ベースイメージを汚染
         → 正規のデプロイフローに乗って全ユーザーに配布される
         → 検知が極めて困難
```

代表的な事例：
- **SolarWinds（2020）** — ビルドサーバーに侵入し署名済みアップデートにバックドアを混入
- **CodeCov（2021）** — CI スクリプトを改ざんし、実行した全社の環境変数（シークレット）を窃取
- **XZ Utils（2024）** — OSS のメンテナーになりすまし圧縮ライブラリにバックドアを混入

---

## SLSA フレームワーク

**Supply-chain Levels for Software Artifacts。**  
Google が提唱したサプライチェーンのセキュリティ成熟度フレームワーク。4段階で評価する。

| レベル | 要件 | 内容 |
|---|---|---|
| SLSA 0 | なし | 保証なし |
| SLSA 1 | Provenance | ビルドのプロベナンス（出所情報）が存在する |
| SLSA 2 | Hosted Build | 認証されたホスト型ビルドサービスを使用 |
| SLSA 3 | Hardened Build | ビルド環境が改ざんから保護されている |
| SLSA 4（廃止→L3） | Two-party Review | 全変更がレビューされ、密閉されたビルド |

```
Provenance（出所情報）に含まれるもの:
  - どのソースコードから（コミットハッシュ）
  - どのビルドシステムで（GitHub Actions / Cloud Build）
  - どのビルダーが実行したか
  → これを改ざんできない形で署名・保管する
```

---

## コンテナイメージのリスク

```
イメージのリスク源:
  ① ベースイメージの脆弱性（ubuntu:latest に含まれる CVE）
  ② アプリの依存ライブラリの脆弱性（Log4Shell 等）
  ③ Dockerfile の設定ミス（root 実行・不要なツールの組み込み）
  ④ 悪意ある公開イメージ（Docker Hub の typosquatting）
  ⑤ ビルドパイプラインへの侵入による混入
```

---

## イメージスキャン

### Trivy

**最も広く使われているオープンソースの脆弱性スキャナー。**  
イメージ・ファイルシステム・Git リポジトリ・K8s クラスタを対象にスキャンできる。

```bash
# イメージのスキャン
trivy image my-app:v1.2.3

# 出力例
my-app:v1.2.3 (debian 11.6)
Total: 3 (CRITICAL: 1, HIGH: 2, MEDIUM: 0, LOW: 0)

┌─────────────────┬────────────────┬──────────┬───────────────┐
│    Library      │ Vulnerability  │ Severity │ Fixed Version │
├─────────────────┼────────────────┼──────────┼───────────────┤
│ openssl         │ CVE-2023-0286  │ CRITICAL │ 3.0.8-1       │
│ libssl3         │ CVE-2022-4304  │ HIGH     │ 3.0.8-1       │
└─────────────────┴────────────────┴──────────┴───────────────┘

# 重大度でフィルタ（CRITICAL / HIGH のみ）
trivy image --severity CRITICAL,HIGH my-app:v1.2.3

# 終了コードで CI を止める（CRITICAL があれば exit 1）
trivy image --exit-code 1 --severity CRITICAL my-app:v1.2.3

# Dockerfile のミス設定もスキャン
trivy config ./Dockerfile

# 実行中クラスタ全体をスキャン
trivy k8s --report=summary cluster
```

### CI/CD への組み込み

```yaml
# GitHub Actions での Trivy スキャン
name: Container Security Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Build Image
      run: docker build -t my-app:${{ github.sha }} .

    - name: Run Trivy
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: my-app:${{ github.sha }}
        format: sarif                  # GitHub Security タブに結果を表示
        output: trivy-results.sarif
        severity: CRITICAL,HIGH
        exit-code: 1                   # CRITICAL/HIGH があればパイプラインを停止

    - name: Upload Trivy Results
      uses: github/codeql-action/upload-sarif@v3
      with:
        sarif_file: trivy-results.sarif
```

### Artifact Registry の脆弱性スキャン（GCP）

```hcl
# Terraform: Artifact Registry でプッシュ時に自動スキャンを有効化
resource "google_artifact_registry_repository" "main" {
  location      = "asia-northeast1"
  repository_id = "production"
  format        = "DOCKER"

  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"
    condition {
      tag_state = "UNTAGGED"
      older_than = "604800s"   # 1週間以上前の untagged イメージを削除
    }
  }
}
```

---

## イメージの署名（cosign / Sigstore）

**イメージをビルドしたのが誰か・どのパイプラインか**を暗号的に証明する。  
Sigstore はコード署名をパブリログ（Rekor）で透明化するオープンソースエコシステム。

### cosign によるイメージ署名

```bash
# Keyless 署名（OIDC トークンを使用。鍵管理不要）
# CI 環境（GitHub Actions / Cloud Build）で実行

# インストール
brew install cosign

# Keyless 署名（GitHub Actions 上で実行する想定）
cosign sign \
  --yes \
  asia-northeast1-docker.pkg.dev/my-project/production/my-app@sha256:abc123...

# 署名の検証
cosign verify \
  --certificate-identity-regexp="https://github.com/my-org/my-repo" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  asia-northeast1-docker.pkg.dev/my-project/production/my-app@sha256:abc123...
```

### GitHub Actions での署名ワークフロー

```yaml
name: Build, Scan, Sign
on:
  push:
    branches: [main]

permissions:
  id-token: write    # Keyless 署名に必要
  contents: read

jobs:
  build-and-sign:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Authenticate to GCP
      uses: google-github-actions/auth@v2
      with:
        workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
        service_account: ${{ secrets.WIF_SA }}

    - name: Build and Push
      run: |
        IMAGE="asia-northeast1-docker.pkg.dev/my-project/production/my-app"
        docker build -t $IMAGE:${{ github.sha }} .
        docker push $IMAGE:${{ github.sha }}
        # ダイジェストを取得
        echo "DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' $IMAGE:${{ github.sha }})" >> $GITHUB_ENV

    - name: Scan with Trivy
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: ${{ env.DIGEST }}
        severity: CRITICAL
        exit-code: 1

    - name: Sign Image with cosign
      uses: sigstore/cosign-installer@v3
      
    - run: |
        cosign sign --yes ${{ env.DIGEST }}
      # スキャンをパスしたイメージだけ署名される
```

---

## SBOM（Software Bill of Materials）

**ソフトウェアに含まれる全コンポーネントの一覧表。**  
新しい CVE が公開されたとき、影響を受けるシステムをすばやく特定できる。

```bash
# Trivy で SBOM を生成（CycloneDX 形式）
trivy image --format cyclonedx --output sbom.json my-app:v1.2.3

# Syft でも生成できる
syft my-app:v1.2.3 -o cyclonedx-json=sbom.json

# SBOM をイメージに添付（cosign でアタッチ）
cosign attach sbom --sbom sbom.json \
  asia-northeast1-docker.pkg.dev/my-project/production/my-app@sha256:abc123...

# 添付された SBOM を取得
cosign download sbom \
  asia-northeast1-docker.pkg.dev/my-project/production/my-app@sha256:abc123...
```

---

## Admission Controller による強制

スキャン済み・署名済みのイメージだけをデプロイできるように、  
クラスタ側でゲートを設ける。

### Binary Authorization（GKE）

```hcl
# Terraform: Binary Authorization ポリシーの設定
resource "google_binary_authorization_policy" "policy" {
  admission_whitelist_patterns {
    name_pattern = "gcr.io/google_containers/*"   # GKE システムイメージは除外
  }

  default_admission_rule {
    evaluation_mode  = "REQUIRE_ATTESTATION"
    enforcement_mode = "ENFORCED_BLOCK_AND_AUDIT_LOG"

    require_attestations_by = [
      google_binary_authorization_attestor.prod_attestor.name
    ]
  }
}

resource "google_binary_authorization_attestor" "prod_attestor" {
  name = "prod-attestor"
  attestation_authority_note {
    note_reference = google_container_analysis_note.attestation_note.name
    public_keys {
      id = data.google_kms_crypto_key_version.signing_key.id
      pkix_public_key {
        public_key_pem      = data.google_kms_crypto_key_version.signing_key.public_key[0].pem
        signature_algorithm = "ECDSA_P256_SHA256"
      }
    }
  }
}
```

### Kyverno でイメージ署名を検証

```yaml
# cosign で署名されたイメージのみデプロイを許可
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
spec:
  validationFailureAction: Enforce
  rules:
  - name: check-image-signature
    match:
      any:
      - resources:
          kinds: ["Pod"]
    verifyImages:
    - imageReferences:
      - "asia-northeast1-docker.pkg.dev/my-project/production/*"
      attestors:
      - count: 1
        entries:
        - keyless:
            subject: "https://github.com/my-org/my-repo/.github/workflows/build.yml@refs/heads/main"
            issuer: "https://token.actions.githubusercontent.com"
            rekor:
              url: https://rekor.sigstore.dev
```

---

## ベースイメージのセキュリティ

```dockerfile
# 悪い例
FROM ubuntu:latest           # 毎回内容が変わる・不要なパッケージが多い
FROM python:3.11             # 同上

# 良い例1: Distroless（Google 製）
FROM gcr.io/distroless/python3-debian12
# シェルなし・パッケージマネージャなし・最小限のライブラリのみ
# → 攻撃者がシェルを取得しても操作できるツールがない

# 良い例2: Alpine（軽量だが musl libc に注意）
FROM python:3.12-alpine

# 良い例3: マルチステージビルド（ビルド環境を本番イメージに含めない）
FROM python:3.12 AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM gcr.io/distroless/python3-debian12
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY app.py .
USER nonroot
CMD ["app.py"]
```

### ベースイメージのピン留め

```dockerfile
# タグは可変（latest は特に危険）
FROM ubuntu:22.04        # 内容が変わる可能性がある

# ダイジェストでピン留め（推奨）
FROM ubuntu@sha256:27cb6e6ccef575a4698b66f5de06c7ecd61589132d5a91d098f7f3f9285415a9
```

---

## タグ vs ダイジェスト

```yaml
# 危険: タグは上書き可能
image: my-app:latest        # 攻撃者がレジストリを侵害してタグを上書きできる
image: my-app:v1.2.3        # タグは mutable（変更可能）

# 安全: ダイジェストは不変
image: my-app@sha256:abc123def456...   # ハッシュ値は変更不可能
```

---

## チェックリスト

```
□ Trivy を CI/CD に組み込み CRITICAL 検出でパイプラインを止めている
□ SBOM を生成し、イメージに添付している
□ cosign（Keyless）でイメージに署名している
□ Kyverno / Binary Authorization で署名検証を Admission Control している
□ ベースイメージをダイジェスト指定でピン留めしている
□ Distroless / Alpine など最小ベースイメージを使用している
□ マルチステージビルドでビルドツールを本番イメージから除いている
□ Docker Hub 等の公開イメージを直接使わず、承認済みレジストリにミラーしている
□ Artifact Registry / ECR の脆弱性スキャンを有効化している
□ ベースイメージを定期的に更新して CVE をパッチしている
```

---

## 参考文献

- SLSA Framework（slsa.dev）— サプライチェーンの成熟度モデルと Provenance の仕様
- Sigstore / cosign 公式ドキュメント（docs.sigstore.dev）— Keyless 署名と Rekor ログの仕組み
- Trivy 公式ドキュメント（aquasecurity.github.io/trivy）— スキャン対象・出力フォーマット・CI 統合
- NIST SP 800-161r1『Cybersecurity Supply Chain Risk Management』（2022）— サプライチェーンリスク管理の公式ガイドライン
- Google Cloud『Binary Authorization』公式ドキュメント — GKE での署名検証と Terraform 設定
