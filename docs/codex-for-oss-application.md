# Codex for Open Source — application draft

Prepared: 23 October 2026. This is a draft, not a submitted application or an award announcement.

Official form: https://openai.com/form/codex-for-oss/

## Public project information

- GitHub username: `ferdiertekin-ops`
- Repository: https://github.com/ferdiertekin-ops/askeri-terimler-sozlugu
- Project: Çevrimiçi Askerî Terimler Sözlüğü (1876–1918)
- Maintainer: Ferdi Ertekin
- Role: Primary maintainer

The form requires the email associated with the applicant's ChatGPT account. Verify it with the applicant; a GitHub contact email is not proof of the ChatGPT account email. The OpenAI Organization ID must also be supplied if required by the selected form options. Neither private account information nor organization identifiers should be committed here.

## Why does this repository qualify? (maximum 500 characters)

This actively maintained web application supports an English-Turkish dictionary of Ottoman military terminology (1876-1918). It serves digital humanities and historical-document research through bilingual interfaces, variant-aware search, stable entry URLs and editorial revision tools. Its MIT-licensed software can support other terminology projects; scholarly data has separate terms. We apply on the basis of specialist relevance, not claimed mass adoption.

## Why does this project need Codex Security? (maximum 500 characters)

The application combines public search with editor authentication, member accounts, content submissions and Cloudflare D1 storage. I would use Codex Security to review authorization boundaries, session and CSRF handling, input validation and accidental data exposure in this repository. Findings would be assessed by the maintainer before changes are merged or deployed. Access would be limited to systems I administer.

## How will you use API credits? (maximum 500 characters)

I would use credits for maintainer-reviewed pull request analysis, regression-test development, issue triage and release documentation, focusing on bilingual search, response times and application security. Proposed automation would work on code and synthetic fixtures, exclude credentials and member records, and require human review before merging or deployment. Historical entries and citations would remain subject to editorial source verification.

## Anything else we should know? (maximum 500 characters)

I maintain both the application and its scholarly publication workflow. Recent commits improve search ranking, the term quiz and response behavior, including regression checks for stalled maintenance and stale requests. The repository includes software checks and documentation. Support would help sustain a specialist digital humanities project. The MIT software license excludes dictionary data and artwork; I am not presenting the dataset as open data.

## Evidence and limits

- Public, non-archived repository with maintainer write access, checked on 23 October 2026.
- Maintenance examples: [response handling](https://github.com/ferdiertekin-ops/askeri-terimler-sozlugu/commit/9276ad1169940aa2e5efbd87ccdc6c9edce8ec7f), [search](https://github.com/ferdiertekin-ops/askeri-terimler-sozlugu/commit/ab03a90090df5c47924594962d8d82ed3973344b), [term game](https://github.com/ferdiertekin-ops/askeri-terimler-sozlugu/commit/b254b7fb91961fca5e39c710ddb110686dd5311d).
- Existing checks are listed in `package.json`; their presence alone is not a report that they have passed.
- No visitor counts, monthly downloads, institutional adoption or dependency statistics have been verified for this application.
- The API-credit uses above are proposed future work, not an existing production integration.
- Eligibility and selection are determined by OpenAI; preparing documentation does not ensure acceptance.
