---
name: humanizer-tr-akademik
description: |
  Türkçe akademik ve tarih yazısını doğal hâle getirirken olgusal doğruluğu,
  kaynak tenkidini, tarihsel terminolojiyi, kronolojiyi, dipnotları, çeviri ve
  transkripsiyon sadakatini korur. blader/humanizer yaklaşımının Türkçe akademik
  tarihçilik için uyarlanmış kişisel sürümüdür.
license: MIT
metadata:
  version: "2.9.1-tr.1"
  upstream: "blader/humanizer"
---

# Humanizer TR Akademik

Bu skill, `blader/humanizer` yaklaşımını Türkçe akademik tarihçilik için uyarlar. Amaç yalnızca AI izlerini azaltmak değildir. Metnin olgusal, kaynakbilimsel, kronolojik ve terminolojik doğruluğu üsluptan önce gelir.

## Öncelik sırası

Çatışma hâlinde şu sıra geçerlidir:

1. Kullanıcının açık ve güncel talimatı.
2. Kaynak metne, doğrudan alıntıya, atfa ve maddi olguya sadakat.
3. Bu skill'deki Türkçe akademik tarihçilik kuralları.
4. Genel Humanizer stil kuralları.
5. Varsayılan yazı tercihleri.

Bir metni daha doğal kılmak uğruna ad, tarih, sayı, unvan, kurum, sayfa, fon, DOI, URL, alıntı, künye veya tarihsel açıklama icat etme.

## Türkçe akademik tarihçilik kuralları

### Olgu, kavram ve yorum

Olgu omurga, kavram açıklama aracı, kaynak tenkidi hükmün sınırı olsun. Kavramı doğrulanmış olguların ilişkisinden çıkar; kuramı malzemeye giydirme. Eşzamanlılığı tek başına nedensellik gibi sunma.

Kaynak sözü, tarihsel olgu, tarihçinin yorumu ve sonraki aktarım katmanlarını ayır. Bir kaynağın iddiasını tarihçinin hükmü gibi yazma; ihtimali kesinliğe, rivayeti olguya dönüştürme.

### Kaynak disiplini

Birincil kaynakları mümkün olduğunda resmî veya akademik kaynaklarla doğrula. Hafızayı kaynak sayma. Tam metin, önizleme, özet, katalog kaydı ve arama sonucu arasındaki farkı koru. Görülmeyen kaynağı okunmuş gibi sunma. Negatif taramayı yokluk kanıtı sayma.

Gerekli olduğunda epistemik sınırı `[doğrulandı]`, `[muhtemel]`, `[spekülatif]` veya `[doğrulanamadı]` ile belirt; ancak bu işaretleri mekanik biçimde metne yayma.

### Ana metin ve dipnot

Dipnotları ana metinden bağımsız kabul etme. Ana metindeki olgu, yorum, tarih, kişi ve kurum adı, kavram ve iddiaları dipnotlarla çapraz denetle. Dipnotun ana metni gerçekten destekleyip desteklemediğini sınayarak düzenle.

Ana metin ile dipnot arasındaki gereksiz tekrarları ayıkla. Aynı açıklama birden çok dipnotta gereksiz yere yineleniyorsa sadeleştir. Künye, sayfa, tarih, eser adı, yazar adı, kısaltma ve atıf biçimini tutarlı tut.

### Türkçe üslup

Aksi açıkça istenmedikçe kurallı, doğal ve ölçülü Türkçe kullan. Devrik, tekrarlı, abartılı ve yapay biçimde gösterişli cümlelerden kaçın. Mekanik geçişler, hazır kalıp sonuç cümleleri, gereksiz soyutlama ve akademik görünme amacıyla kullanılan moda kelimeleri ayıkla.

`Bâbıâli` yazımını kullan. Uygun bağlamda `zihin` yerine `akıl`, `özgür` yerine `hür` tercih edilebilir; fakat kaynak metnin anlamını veya yerleşik teknik terimi değiştirme.

`Hizalanma`, `anlatısal`, `çerçevelemek` gibi mekanik veya şablonlaşmış ifadeleri sırf akademik görünüm için kullanma. `Kanıt` kelimesini metodolojiyi görünür kılacak ölçüde tekrar etme; kaynak disiplini metnin kuruluşuna yansısın.

Arı duru Türkçe kullan; tarihsel ve kavramsal kesinliği sadeleştirme uğruna feda etme. `Muhayyile`, `tasavvur` gibi yerleşik kavramları gerektiğinde ölçülü biçimde koru.

### Tarihsel terminoloji

1876–1918 askerî-idarî terminolojisinde üç düzeyi ayır: dönem karşılığı, işlevsel muadil ve modern açıklama. Yabancı bir kurumu Osmanlılaştırma; modern kurumu geçmişe taşıma.

Osmanlı bağlamında `Bahriye Nezâreti`, İngiliz bağlamında `Amirallik` ayrımını koru. `Parlement` için bağlama göre `Meclis` veya `Meclis-i Mebusan` kullan. Yerleşik dönem karşılıklarını ve kullanıcı tarafından belirlenmiş kurum, rütbe ve yer adlarını bozma.

### Çeviri ve transkripsiyon

Çeviri ve transkripsiyonda ekleme, atlama veya yorum katma. Kritik terimi ilk kullanımda gerekiyorsa özgün biçimiyle köşeli parantez içinde ver. Okunamayan yeri `[okunamadı]`, kuşkulu okumayı `[?]` ile göster.

Doğrudan alıntının kelimelerini, tarihlerini, imlasını veya kesinlik derecesini humanize etme. Yalnız alıntı dışındaki açıklama metnini düzelt.

### Noktalama ve biçim

Genel Humanizer'daki en dash yasağı Türkçe akademik metne uygulanmaz. Tarih, sayı ve sayfa aralıklarında en dash korunur: `1876–1918`, `14–28 Nisan 1909`, `s. 21–24`. Em dash (`—`) kullanıcı üslubu veya kaynak metin gerektirmedikçe tercih edilmez.

Tırnak işaretlerinde kullanıcının, yayın organının veya dosyanın standardını koru; İngilizce Humanizer'daki düz tırnak tercihini Türkçeye mekanik biçimde uygulama.

Belge veya dosya çıktısı hazırlanıyorsa aksi belirtilmedikçe Cambria ve iki yana hizalama kullan.

## Humanizer denetim kalıpları

Aşağıdaki işaretleri tek başına suçlayıcı sayma. Birkaçının kümelenmesine bak ve düzeltme sırasında yazarın gerçek sesini yok etme.

1. Önemi, mirası veya daha geniş eğilimleri gereksiz yere büyütme.
2. Şöhret ve medya görünürlüğünü anlamsız biçimde sıralama.
3. Yüzeysel gerund/ortaç cümleleriyle sahte derinlik üretme.
4. Reklam ve tanıtım dili kullanma.
5. Belirsiz otorite atıfları ve kaçamak ifadeler.
6. Şablon `zorluklar ve gelecek` bölümleri.
7. Yüksek frekanslı AI kelime dağarcığının kümelenmesi.
8. Basit yüklemlerden kaçıp şişirilmiş eşdeğerler kullanma.
9. `Yalnızca X değil Y` türü negatif paralellikleri aşırı kullanma.
10. Her şeyi yapay üçlü gruplara ayırma.
11. Aynı özne için gereksiz eşanlamlı döndürme.
12. Gerçek bir ölçek oluşturmayan `X'ten Y'ye` dizileri.
13. Faili gereksiz gizleyen edilgenlik ve öznesiz parçalar.
14. Em dash'i aşırı kullanma; Türkçe tarih/sayfa aralıklarındaki en dash istisnasını koru.
15. Mekanik kalın yazı vurgusu.
16. Her satırı kalın başlıklı dikey listeye dönüştürme.
17. Başlıklarda gereksiz İngilizce Title Case.
18. Akademik metinde süs amaçlı emoji.
19. Tırnak işaretini içerikten bağımsız AI belirtisi sayma; yayın standardını koru.
20. `Elbette`, `Umarım yardımcı olur`, `İstersen` gibi sohbet kalıntılarını metne taşıma.
21. Bilgi kesim tarihi mazeretleri ve kaynaksız boşluk doldurma.
22. Sonuç bölümünde ana metni mekanik biçimde yeniden özetleme.
23. Kullanıcının veya kaynağın vermediği örnekleri uydurma.
24. `Açıkça`, `şüphesiz`, `kesinlikle` gibi gereksiz kesinlik artırıcılarını ekleme.
25. Paragrafları aynı uzunluk ve ritme zorlayarak tekdüze kadans üretme.
26. Bileşik sıfatları ve tireli yapıları gereksiz çoğaltma.
27. `Asıl soru`, `özünde`, `gerçekte önemli olan` gibi sahte otorite kalıpları.
28. `Şimdi bakalım`, `bunu inceleyelim`, `işte bilmeniz gerekenler` gibi metadiskurla bölümü açma.
29. Başlığı tek cümleyle yeniden söyleyen boş giriş paragrafı.
30. Belgeyi mevcut hâliyle açıklamak yerine önceki sürüm/diff üzerinden anlatma.
31. Art arda kısa cümlelerle yapay dramatik vurgu ve slogan üretme.
32. `X, Y'nin dilidir/mimarisidir/para birimidir` türü boş aforizmalar.
33. `Açık konuşalım`, `işin gerçeği`, `bakın` gibi sahte samimiyet açılışları.

## Yanlış pozitiflerden kaçın

Kusursuz dil bilgisi, akademik kelime dağarcığı, tek bir geçiş kelimesi, tek bir em dash, tek bir kısa vurgu cümlesi veya tırnak biçimi tek başına AI göstergesi değildir. Özgül ve sıra dışı ayrıntıları, tarihsel terimleri, yazara özgü cümle ritmini, gerçek tereddütleri ve kaynak kaynaklı dil özelliklerini koru.

## Çalışma süreci

1. Kaynak metni, dipnotları ve kullanıcı talimatlarını birlikte oku.
2. Maddi iddiaları, alıntıları, tarihleri, özel adları, atıfları ve tarihsel terimleri sabitle.
3. AI-yazım kalıplarını kümeler hâlinde tespit et; tek bir belirtiye dayanarak metni düzleştirme.
4. Gereksiz tekrar, şişirilmiş önem, promosyon dili, sahte derinlik ve mekanik geçişleri ayıkla.
5. Cümle uzunluklarını doğal biçimde çeşitlendir; fakat tarihsel ve kavramsal kesinliği koru.
6. Ana metin ile dipnotları yeniden çapraz oku.
7. Son denetimi olgu, kronoloji, gönderge, terim, atıf, argüman, çeviri ve kaynakça bakımından yap.
8. Son metinde kaynak kapsamını aşan yeni bir hüküm, anakronizm veya gereksiz kesinleştirme bulunmadığını doğrula.

## Çıktı

Kullanıcı yalnızca düzeltilmiş metni istiyorsa yalnız nihai metni ver. Denetim veya gerekçe de istiyorsa değişiklikleri kısa ve somut gerekçelerle açıkla. Akademik metinde `insanileştirme` adına kişilik, mizah, birinci tekil şahıs veya yeni yorum ekleme.

## Kaynak ve lisans

Temel yaklaşım: `blader/humanizer`, MIT License. Bu uyarlama, Humanizer'ın AI-yazım kalıplarını Türkçe akademik tarihçilik, kaynak tenkidi, dipnot denetimi, terminoloji, çeviri ve transkripsiyon kurallarıyla birleştirir.
