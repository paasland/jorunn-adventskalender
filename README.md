# Jorunns adventskalender (statisk, GitHub Pages)

Ren statisk side – ingen server. Filer:

- `index.html` – kalenderen. `/?luke=7` zoomer inn til luke 7 og åpner den.
- `admin.html` – redigering av tekstene. Lagrer ved å committe `messages.json` via GitHub API.
- `lock.js` – AES-GCM-kryptering av lukene (delt av index og admin).
- `messages.json` – lukene, **krypterte**. Lenker i teksten: `[KLIKK HER](https://...)`.
- `config.json` – `year` (kalenderår) og `bypassHash` (SHA-256 av hemmelig kode).

## Publisere
1. Repo → Settings → Pages → *Deploy from a branch* → `main` / `(root)`.
2. Siden ligger på `https://<eier>.github.io/<repo>/`.

## Admin
1. Lag token: GitHub → Settings → Developer settings → Fine-grained tokens. Velg kun dette repoet, *Repository permissions → Contents: Read and write*.
2. Åpne `/admin.html`, skriv repo (`eier/navn`) og token, logg inn. Tokenet lagres kun i nettleserens sessionStorage.
3. Rediger og trykk Lagre. Pages bygger på nytt – endringen er synlig etter ca. ett minutt.
4. Under *Innstillinger* kan du sette hemmelig bypass-kode. Bruk: trykk 5 ganger raskt på tittelen på kalendersiden.

## Test lokalt
    python -m http.server 8000     (eller: npx serve)
Åpne `http://localhost:8000/?luke=3&fakedate=2026-12-03` (`fakedate` virker kun på localhost).
Sett en bypass-kode lokalt ved å lime sha256-hash inn i `config.json`:

    node -e "console.log(require('crypto').createHash('sha256').update('minkode').digest('hex'))"

## Beskyttelse av innholdet
- Hver luke krypteres med en egen nøkkel utledet fra en *hovedhemmelighet* (lagres kun i admin-nettleserens localStorage – lagre den også i en passordbehandler).
- Nøkkelen ligger i QR-koden som URL-fragment: `…/?luke=5#k=NØKKEL`. Fragmentet sendes aldri til serveren. Uten QR-koden er innholdet uleselig, selv for den som leser repoet.
- Admin → *QR-koder (utskrift)* lager utskriftsark. Ikke legg disse i repoet (`qr-koder/` er git-ignorert).
- Første gang: åpne admin og trykk *Lagre alle* for å kryptere eksisterende tekster.
- Datosperren er fortsatt kun i grensesnittet; den som har papiret kan åpne luken tidlig.
- Gamle klartekstversjoner finnes i git-historikken. Delingslenker til filmer bør i tillegg ha utløpsdato.
