# Security policy

## Reporting a vulnerability

Please do not publish credentials, member information or an exploitable vulnerability in a public issue.

Use GitHub's private vulnerability reporting option on this repository if it is available. Otherwise, contact the maintainer at **ferdiertekin@trakya.edu.tr** with the subject **ATS security report**. Start with a brief description and request a suitable private channel before sending sensitive evidence.

Include the affected component or URL, the relevant commit if known, reproducible steps using synthetic data, likely impact and any proposed fix. Do not access other users' data or test destructively against the live site.

## Maintenance scope

Security fixes are developed against the current `main` branch. There is no published long-term support schedule for earlier snapshots. This policy does not promise a response deadline or a paid bounty.

The application includes public search endpoints and administrative/account features. Deployment secrets, bindings and third-party service settings are managed outside this repository. Passing repository checks does not certify a production deployment as secure.

## Türkçe

Güvenlik açığını, parolayı veya üye bilgilerini herkese açık issue içinde paylaşmayınız. Varsa GitHub özel güvenlik bildirimi özelliğini kullanınız; yoksa yukarıdaki kurumsal adrese kısa bir ilk bildirim gönderiniz. Canlı sistemde yıkıcı test yapmayınız ve başka kullanıcıların verilerine erişmeyiniz.
