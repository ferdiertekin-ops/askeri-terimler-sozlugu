# Humanizer TR Akademik

Türkçe akademik tarih yazımı için uyarlanmış Humanizer skill'i. Temel yaklaşım `blader/humanizer` (MIT) üzerine kuruludur; kaynak tenkidi, dipnot çapraz denetimi, tarihsel terminoloji, çeviri/transkripsiyon sadakati ve Türkçe üslup kuralları eklenmiştir.

## GitHub'dan kurulum

Bu skill, `humanizer-tr-akademik` dalında tutulur; `main` dalındaki Askerî Terimler Sözlüğü kodunu etkilemez.

Claude Code veya Codex dâhil desteklenen ajanlara global kurulum:

```bash
npx skills add https://github.com/ferdiertekin-ops/askeri-terimler-sozlugu/tree/humanizer-tr-akademik/skills/humanizer-tr-akademik --global --agent '*' -y
```

Yalnız Claude Code:

```bash
npx skills add https://github.com/ferdiertekin-ops/askeri-terimler-sozlugu/tree/humanizer-tr-akademik/skills/humanizer-tr-akademik --global --agent claude-code -y
```

Yalnız Codex:

```bash
npx skills add https://github.com/ferdiertekin-ops/askeri-terimler-sozlugu/tree/humanizer-tr-akademik/skills/humanizer-tr-akademik --global --agent codex -y
```

## Öncelik

1. Kullanıcının açık talimatı.
2. Kaynak/metin ve doğrudan alıntı sadakati.
3. Türkçe akademik tarihçilik profili.
4. Genel Humanizer kuralları.

## Önemli uyarlamalar

- Tarih ve sayfa aralıklarındaki en dash korunur (`1876–1918`, `s. 21–24`).
- `Bâbıâli` yazımı korunur.
- Dönem karşılığı, işlevsel muadil ve modern açıklama ayrılır.
- Çeviri/transkripsiyonda ekleme veya yorum yapılmaz.
- Ana metin ile dipnotlar çapraz denetlenir.
- Kaynakta bulunmayan ad, tarih, sayı, alıntı veya künye üretilmez.
- Akademik üslup uğruna yeni olgu veya yorum eklenmez.
