# Contributing / Katkıda bulunma

Thank you for helping maintain the Military Terms Dictionary. Ferdi Ertekin maintains the project.

## Software changes

1. Open an issue describing the problem, affected URL or component, steps to reproduce and expected result.
2. Create a branch and keep the pull request focused on the stated problem.
3. Run `npm run check` from the repository root using Node.js with `node:sqlite` support. For account or speech changes, also run `node scripts/check-community.mjs`.
4. Describe the behavior changed and the checks actually run. Check both Turkish and English interfaces for interface changes.

The standard suite covers syntax, SEO, legacy preview behavior, search, the term game and response behavior. It does not test production credentials, live service availability or historical accuracy.

Keep credentials, user records, production exports and private reports out of issues, fixtures and commits. Use synthetic data for tests. For vulnerabilities, follow [SECURITY.md](SECURITY.md).

## Historical content corrections

Give the entry URL, the current wording, the proposed correction and a precise source reference. Include page or folio and document date or identifier where applicable. Distinguish a reading correction from an interpretation or a proposed equivalent. Do not silently replace historical spelling or assume that ranks from different armies are interchangeable.

A search snippet, OCR output or model-generated answer alone is insufficient for a historical correction. The maintainer reviews scholarly changes before publication. Software review does not establish the accuracy of a historical claim.

## License of contributions

Submit only material you are entitled to contribute. Software contributions are proposed under the repository's MIT software license, with third-party notices preserved. Dictionary data and scholarly content are separately governed by [LICENSE-CONTENT.md](LICENSE-CONTENT.md); do not assume an open data license or submit restricted third-party material.

## Türkçe kısa rehber

Yazılım hatası için tekrar edilebilir adımları ve beklenen sonucu belirtiniz. Madde düzeltmesi için mevcut ifade, önerilen ifade ve sayfa/varak bilgisi içeren kaynak künyesi veriniz. Tarihî imlayı gerekçesiz değiştirmeyiniz. Gizli değerleri ve üye bilgilerini herkese açık kayıtlara eklemeyiniz. Yalnızca yaptığınız denetimleri yapılmış olarak bildiriniz.
