// ============================================================
// Svatební web — JavaScript
// Vše je "progressive enhancement": bez JS web plně funguje,
// jen chybí odpočet a animace.
// ============================================================

const bezPohybu = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Scroll je od vypnutí history.scrollRestoration (viz index.html, <head>)
// čistě naše režie — doskroluje na #kotvu z URL, jinak na úplný začátek.
// behavior: "instant", protože web má globálně CSS scroll-behavior:
// smooth, které by jinak i tohle plynule animovalo.
function doskrolovatNaKotvuNeboZacatek() {
  const cil = location.hash && document.getElementById(location.hash.slice(1));
  if (cil) {
    cil.scrollIntoView({ behavior: "instant", block: "start" });
  } else {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }
}

// Back/Forward MEZI KOTVAMI v rámci téže stránky (např. Program → Místo
// → zpět) je same-document navigace, žádný nový DOMContentLoaded se
// nekoná — proto vlastní posluchač na "popstate". Skutečné opuštění a
// návrat na stránku (jiný dokument) řeší sekce -1 v DOMContentLoaded níže.
window.addEventListener("popstate", doskrolovatNaKotvuNeboZacatek);

// Klíč pro uložení scroll pozice — jen pro návrat přes Back/Forward
// MIMO bfcache (viz sekce -1 níže). `pagehide`, ne `beforeunload`/
// `unload` — ty by stránku vyřadily ze způsobilosti pro bfcache, což by
// paradoxně zhoršilo přirozené chování Back/Forward, které bfcache řeší
// samo, mnohem lépe než my.
const KLIC_SCROLLU = "scrollY:" + location.pathname;
window.addEventListener("pagehide", () => {
  try {
    sessionStorage.setItem(KLIC_SCROLLU, String(window.scrollY));
  } catch (e) {}
});

document.addEventListener("DOMContentLoaded", () => {

  // ------------------------------------------------------------
  // -1. Ruční obnova scroll pozice (viz index.html, <head> —
  //     scrollRestoration je "manual", takže prohlížeč už sám
  //     nerestoruje vůbec nic, ani #kotvu z URL při reloadu).
  //
  //     - back_forward mimo bfcache → obnovit uloženou pozici ze
  //       sessionStorage (bfcache tenhle kód vůbec nespustí, řeší se
  //       sám, přirozeně).
  //     - reload s #kotvou v URL → doskrolovat na ni ručně (jediný
  //       vedlejší efekt vypnutí automatické restorace — prohlížeč bez
  //       ní na reloadu přestane sám doskrolovat i na #kotvu).
  //     - reload bez #kotvy / čerstvá navigace → nic neděláme, stránka
  //       přirozeně zůstává na úplném začátku.
  // ------------------------------------------------------------
  try {
    const zaznam = performance.getEntriesByType &&
      performance.getEntriesByType("navigation")[0];

    if (zaznam && zaznam.type === "back_forward") {
      const ulozene = sessionStorage.getItem(KLIC_SCROLLU);
      if (ulozene !== null) {
        window.scrollTo({ top: parseInt(ulozene, 10), left: 0, behavior: "instant" });
      }
    } else if (zaznam && zaznam.type === "reload") {
      doskrolovatNaKotvuNeboZacatek();
    }
  } catch (e) {}

  // ------------------------------------------------------------
  // 0. Úvodní přechod (M & M jako rostoucí díra do hero)
  //
  //    Jedna hodnota "progress" na animační snímek řídí VŠE. M&M je
  //    transparentní otvor už od prvního snímku — žádná viditelná
  //    "tmavá" kopie ani crossfade barvy.
  //
  //    Zjednodušené řešení, ~1,4 s celkem:
  //    1) Celou dobu běží čistě SCALE (jeden řetězec SVG transformace
  //       na #introMaskUse) — žádná dilatace, žádné vrstvy navíc,
  //       maska je jen fill. Křivka zrychlování: pomalý, ale nenulový
  //       start → plynulá kontinuální akcelerace → nejrychlejší konec.
  //    2) Od chvíle, kdy M&M vizuálně zabírá většinu obrazovky (ještě
  //       čitelné jako logo), scale dál pokračuje (nikdy se nezastaví)
  //       a SOUČASNĚ se jednou jedinou opacity změnou na celém #intro
  //       plynule "rozpustí" zbývající krémové okolí — stejný pohyb,
  //       ne druhá animace. Kompozitorová vlastnost na jednom prvku —
  //       nejlevnější možná operace, žádné přepočítávání SVG geometrie
  //       za běhu.
  //
  //    JS jen navíc: (a) počká na konkrétní web font použitý v M&M
  //    (ne na všechny fonty stránky), ať se tvar uprostřed neplete,
  //    (b) po dobu běhu zamkne scroll BEZ layout shiftu a schová
  //    navigaci/hero text/scroll-cue, (c) po dohrání intro odstraní
  //    z DOM a teprve POTÉ spustí původní vstupní animaci hero textu
  //    (viz sekce 16 v CSS, "vstup"), (d) při omezení pohybu nebo
  //    chybějící podpoře CSS masky přepne na jednoduché krátké
  //    prolnutí bez zoomu.
  // ------------------------------------------------------------
  const intro = document.getElementById("intro");
  // Na mobilu (stejný breakpoint jako zbytek webu) se M&M animace
  // vůbec nespouští — rovnou hero, jen s běžným jemným vstupním fade-inem.
  const jeMobil = window.matchMedia("(max-width: 999px)").matches;

  if (intro && jeMobil) {
    intro.remove();
    document.body.classList.add("hero-enter");
  } else if (intro) {
    const HOLD = 100;          // ms téměř nepostřehnutelného klidu na startu
    const DELKA_RUSTU = 1300;  // ms — samotný plynulý růst (celkem ≈ 1,4 s)
    const CEKANI_NA_FONT = 150; // bezpečný strop pro JEDEN konkrétní font řez

    const introMaskUse = document.getElementById("introMaskUse");

    const maskySwPodporovane =
      typeof CSS !== "undefined" &&
      CSS.supports &&
      (CSS.supports("mask-image", "url(#x)") ||
        CSS.supports("-webkit-mask-image", "url(#x)"));

    const zjednodusit = bezPohybu || !maskySwPodporovane || !introMaskUse;

    // Kompenzace scrollbaru: `scrollbar-gutter: stable` (viz CSS) řeší
    // moderní prohlížeče samo; tady jen zjišťujeme, jestli je potřeba
    // JS fallback (starší Safari apod.) — měřeno JEDNOU, před zamčením
    // scrollu, aby hodnota odpovídala běžnému (nezamčenému) stavu.
    const scrollbarGutterOk =
      typeof CSS !== "undefined" &&
      CSS.supports &&
      CSS.supports("scrollbar-gutter", "stable");
    const sirkaScrollbaru = scrollbarGutterOk
      ? 0
      : window.innerWidth - document.documentElement.clientWidth;

    document.body.classList.add("intro-running");
    if (!scrollbarGutterOk && sirkaScrollbaru > 0) {
      document.body.style.paddingRight = sirkaScrollbaru + "px";
    }

    const uklidit = () => {
      intro.remove();
      document.body.classList.remove("intro-running");
      document.body.style.paddingRight = "";
      // Původní vstupní animace hero textu (CSS "vstup", viz sekce 16)
      // je gatovaná za touto třídou — spustí se tak čerstvě až TEĎ,
      // ne neviditelně během běhu intra.
      document.body.classList.add("hero-enter");
    };

    // Akcelerující křivka s NENULOVOU počáteční rychlostí (derivace
    // v t=0 je 0.15 — pohyb je znatelný hned od prvního snímku, žádné
    // "zaseknutí"). Lineární + kvadratický + kubický člen dohromady
    // dávají výraznější oblouk než čistá kvadratika: začátek je záměrně
    // pomalejší (uživatel stihne přečíst "M & M"), střední fáze plynule
    // zrychluje a poslední třetina je nejrychlejší — bez zlomu mezi
    // fázemi, protože jde o jednu spojitou funkci. V t=1 přesně 1.
    const easeAkceleruj = (t) => 0.15 * t + 0.25 * t * t + 0.6 * t * t * t;

    const animovat = () => {
      // Rozměry se čtou JEDNOU, před startem smyčky — v samotném
      // requestAnimationFrame se getBoundingClientRect ani jiný
      // vynucený layout nikdy nevolá (kvůli výkonu).
      const rect = intro.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      // SCALE_MAX odvozený od skutečné velikosti obrazovky: cílem je,
      // aby ve chvíli, kdy se rozjede závěrečný fade, už jednotlivé
      // tahy "M & M" byly výrazně větší než viewport. Odhad šířky
      // nápisu při scale 1 = font-size × ~2,4 (poměr "M & M" v
      // použitém řezu). Výsledek omezen na 18–25.
      const fontSizePx =
        parseFloat(getComputedStyle(introMaskUse).fontSize) || 70;
      const logoSirka = fontSizePx * 2.4;
      const potrebnyScale =
        (Math.max(rect.width, rect.height) * 1.6) / logoSirka;
      const SCALE_MAX = Math.min(25, Math.max(18, potrebnyScale));

      const START_SCALE = 1;

      const zacatek = performance.now();

      const krok = (ted) => {
        const uplynulo = ted - zacatek;

        if (uplynulo < HOLD) {
          requestAnimationFrame(krok);
          return;
        }

        // t = reálný, lineární postup v čase (0–1) — na něm stavíme
        // časování závěrečného fade, aby sedělo na skutečné sekundy,
        // ne na zakřivenou "eased" škálu.
        const t = Math.min(1, (uplynulo - HOLD) / DELKA_RUSTU);
        const scale = START_SCALE + (SCALE_MAX - START_SCALE) * easeAkceleruj(t);

        // 1) Jedna transformace na #introMaskUse — scale pokračuje
        //    plynule až do úplného konce (t=1), nikdy se nezastaví
        //    dřív, ani během závěrečného fade.
        introMaskUse.setAttribute(
          "transform",
          `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`
        );

        // 2) Dokončení revealu = JEDNA opacity změna na celém #intro,
        //    ne geometrie navíc — scale se kvůli ní nikde nezastavuje
        //    ani nemění, je to stejný pohyb, jen s přidaným průhledem.
        //    FADE_START posunut na polovinu předchozí hodnoty (0.68 →
        //    0.34), fade tak dostává cca 860 ms reálného času — začíná
        //    dřív a trvá déle. Smoothstep má nulovou derivaci na obou
        //    koncích, takže těsně po FADE_START je průhled ještě prakticky
        //    neznatelný (M&M je krátce čitelné na plné krémové ploše) a
        //    pak plynule sílí až do opacity 0 přesně v t=1.
        const FADE_START = 0.34;
        const uf = Math.max(0, Math.min(1, (t - FADE_START) / (1 - FADE_START)));
        const smoothFade = uf * uf * (3 - 2 * uf);
        intro.style.opacity = 1 - smoothFade;

        if (t < 1) {
          requestAnimationFrame(krok);
        } else {
          // t=1 → intro.style.opacity je přesně 0 (viz výpočet výše).
          // Než #intro smažeme, počkáme na DVA požadavky
          // requestAnimationFrame — standardní záruka, že prohlížeč
          // tento zcela průhledný snímek skutečně vykreslil. Teprve
          // pak je odstranění vizuálně neznatelné.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setTimeout(uklidit, 60);
            });
          });
        }
      };

      requestAnimationFrame(krok);
    };

    const spustit = () => {
      if (zjednodusit) {
        intro.classList.add("intro-simple", "intro-go");
        setTimeout(uklidit, 450);
        return;
      }
      animovat();
    };

    // Čekáme JEN na konkrétní font/řez použitý v M&M (Cormorant
    // Garamond, běžný řez), ne na všechny fonty stránky — waiting na
    // document.fonts.ready by čekalo i na Jost apod., což je zbytečně
    // dlouhé a přispívalo k pocitu "zaseknutí" na startu. Krátký
    // 150ms strop pro jistotu, ať intro nikdy nečeká donekonečna.
    if (document.fonts && document.fonts.load) {
      Promise.race([
        document.fonts.load('400 100px "Cormorant Garamond"').catch(() => {}),
        new Promise((vyres) => setTimeout(vyres, CEKANI_NA_FONT)),
      ]).then(spustit);
    } else {
      spustit(); // starší prohlížeče bez Font Loading API
    }
  }

  // ------------------------------------------------------------
  // 1. Odpočet do svatby (prolog)
  // ------------------------------------------------------------
  const odpocet = document.getElementById("odpocet");
  if (odpocet) {
    const svatba = new Date(2027, 3, 24); // měsíce od 0 → 3 = duben
    const dnes = new Date();
    svatba.setHours(0, 0, 0, 0);
    dnes.setHours(0, 0, 0, 0);
    const dni = Math.round((svatba - dnes) / 86400000);
    if (dni >= 0) {
      if (dni === 0) {
        odpocet.textContent = "je to dnes! · ";
      } else {
        // Zbývající dny zaokrouhlené nahoru na celé týdny
        const tydny = Math.ceil(dni / 7);
        // České skloňování: 1 týden, 2–4 týdny, 5+ týdnů
        const tvar = tydny === 1 ? "týden" : tydny >= 2 && tydny <= 4 ? "týdny" : "týdnů";
        odpocet.textContent = `za ${tydny} ${tvar} · `;
      }
    }
  }

  // ------------------------------------------------------------
  // 2. Jemné odhalení obsahu při scrollu (fade-up)
  //    Třída .reveal se přidává až tady — bez JS nic neskrýváme.
  // ------------------------------------------------------------
  if (!bezPohybu && "IntersectionObserver" in window) {
    const bloky = document.querySelectorAll(
      // Pozor: nikdy neanimovat celé sekce s vlastním pozadím (např. .prolog) —
      // reveal by skryl i barvu pozadí a stránka by "probleskovala"
      ".prolog-line, .prolog-meta, .section, .misto-media, .misto-body, .mezihra, .palette, .finale-content"
    );

    const io = new IntersectionObserver((zaznamy) => {
      for (const z of zaznamy) {
        if (z.isIntersecting) {
          z.target.classList.add("visible");
          io.unobserve(z.target); // každý blok se odhalí jen jednou
        }
      }
    }, { rootMargin: "0px 0px -12% 0px" });

    bloky.forEach((blok) => {
      blok.classList.add("reveal");
      io.observe(blok);
    });
  }

  // ------------------------------------------------------------
  // 3. Jemný parallax velkých fotografií (hero, finále)
  //    Fotka je zvětšená na 110 % a posouvá se o ±4 % výšky.
  //    Předěl má vlastní, výraznější režim — viz sekce 3b.
  // ------------------------------------------------------------
  if (!bezPohybu) {
    const fotky = document.querySelectorAll(".hero-photo img, .finale-photo");
    if (fotky.length) {
      let cekam = false;

      const posun = () => {
        cekam = false;
        const vyskaOkna = window.innerHeight;
        fotky.forEach((img) => {
          const r = img.parentElement.getBoundingClientRect();
          if (r.bottom < 0 || r.top > vyskaOkna) return; // mimo obrazovku
          // -1 až 1 podle toho, kde je střed fotky vůči středu okna
          const pozice = (r.top + r.height / 2 - vyskaOkna / 2) / vyskaOkna;
          img.style.transform = `scale(1.1) translateY(${(-pozice * 4).toFixed(2)}%)`;
        });
      };

      window.addEventListener("scroll", () => {
        if (!cekam) {
          cekam = true;
          requestAnimationFrame(posun); // max. jednou za snímek
        }
      }, { passive: true });

      posun();
    }
  }

  // ------------------------------------------------------------
  // 3b. Předěl — postupné odhalování fotografie při průchodu sekcí
  //
  //     Fotka je ve zdroji vyšší, než kolik se do pásu vejde;
  //     object-fit: cover ji ořízne a my jen posouváme, KTERÁ část
  //     je vidět (object-position), takže se odkrývá skutečný obsah
  //     snímku, ne že by se obrázek mechanicky posouval mimo rám.
  //
  //     Proč ne transform/scale jako u ostatních fotek: zvětšování
  //     by muselo být velké, aby vzniklo dost rezervy, a tím by se
  //     snímek jen přiblížil. Cover navíc sám zaručuje, že se nikdy
  //     neobjeví prázdný okraj, a nedeformuje poměr stran.
  //
  //     100 % = spodní výřez (postavy a kámen zblízka, jako dosud),
  //       0 % = horní výřez (odhalí se louka a les nad rybníkem).
  //     Oba kraje jsou vybrané tak, aby hlavy ani kámen nikdy
  //     nevypadly z rámu — viz rozměry ořezů v images/.
  // ------------------------------------------------------------
  if (!bezPohybu) {
    const predel = document.querySelector(".predel");
    const predelFoto = predel && predel.querySelector("img");
    if (predelFoto) {
      let cekaPredel = false;

      const prekresliPredel = () => {
        cekaPredel = false;
        const vyskaOkna = window.innerHeight;
        const r = predel.getBoundingClientRect();

        // Celý rozsah se rozkládá do CELÉHO průchodu sekce obrazovkou:
        //   r.top =  vyskaOkna  → pás se právě objevuje u spodního okraje
        //   r.top = -r.height   → pás právě zmizel za horním okrajem
        // Proto jmenovatel (vyskaOkna + r.height), ne (vyskaOkna − výška):
        // kratší úsek by znamenal, že se krajní hodnoty vyčerpají, zatímco
        // je fotka ještě velkou částí na obrazovce, a zbytek průchodu by
        // stál na dorazu. Vztah je lineární, takže při rovnoměrném scrollu
        // je i změna výřezu rovnoměrná a obrácení směru je okamžité.
        //
        // Nic se tu neodfiltrovává ani neprodlužuje: hodnota se dopočítá
        // i mimo obrazovku (ořez na 0–1 ji přirozeně drží na krajích),
        // aby na hranicích viditelnosti nevznikl skok z výchozí hodnoty.
        const prusvit = Math.max(1, vyskaOkna + r.height);
        const prubeh = Math.min(1, Math.max(0, (vyskaOkna - r.top) / prusvit));
        predelFoto.style.objectPosition =
          "50% " + ((1 - prubeh) * 100).toFixed(2) + "%";
      };

      window.addEventListener("scroll", () => {
        if (!cekaPredel) {
          cekaPredel = true;
          requestAnimationFrame(prekresliPredel);
        }
      }, { passive: true });
      window.addEventListener("resize", prekresliPredel, { passive: true });

      prekresliPredel();
    }
  }

  // ------------------------------------------------------------
  // 4. Plynulé otevírání a zavírání fotogalerií (details.galerie)
  //    Prohlížeč umí <details> zavřít jen skokově, proto výšku
  //    animujeme sami. Při prefers-reduced-motion necháme výchozí
  //    okamžité chování.
  // ------------------------------------------------------------
  if (!bezPohybu) {
    document.querySelectorAll("details.galerie").forEach((galerie) => {
      const spoustec = galerie.querySelector("summary");
      const obsah = galerie.querySelector(".galerie-grid");
      if (!spoustec || !obsah) return;

      spoustec.addEventListener("click", (udalost) => {
        udalost.preventDefault();
        if (galerie.dataset.animuje) return; // ignoruj klik během animace
        galerie.dataset.animuje = "1";

        if (galerie.open) {
          // Zavírání: nejdřív plynule složit, teprve potom zavřít
          obsah.style.maxHeight = obsah.scrollHeight + "px";
          requestAnimationFrame(() => {
            obsah.style.maxHeight = "0px";
            obsah.style.opacity = "0";
          });
          setTimeout(() => {
            galerie.open = false;
            obsah.style.maxHeight = "";
            obsah.style.opacity = "";
            delete galerie.dataset.animuje;
          }, 620);
        } else {
          // Otevírání: otevřít složené a plynule rozvinout
          galerie.open = true;
          obsah.style.maxHeight = "0px";
          obsah.style.opacity = "0";
          requestAnimationFrame(() => {
            obsah.style.maxHeight = obsah.scrollHeight + "px";
            obsah.style.opacity = "1";
          });
          setTimeout(() => {
            obsah.style.maxHeight = ""; // uvolnit pro responzivní změny
            obsah.style.opacity = "";
            delete galerie.dataset.animuje;
          }, 620);
        }
      });
    });
  }

  // ------------------------------------------------------------
  // 4b. Plynulé rozbalování a sbalování otázek (details.faq-item)
  //
  //     Animuje se SKUTEČNÁ výška obalu odpovědi, takže se spolu
  //     s ní průběžně posouvá i obsah pod otázkou — žádný skok.
  //     Výška se vždy měří z aktuálního obsahu (scrollHeight), nikdy
  //     se neodhaduje max-height: krátká i dlouhá odpověď proto
  //     trvají stejně dlouho a nikde nevzniká prodleva.
  //
  //     Rychlé opakované kliknutí: pohyb se nerestartuje od kraje,
  //     ale pokračuje z právě naměřené výšky, takže se plynule obrátí.
  //     Záměr drží proměnná `cil` — polozka.open je totiž po celou
  //     dobu animace true (obsah musí být v rozložení, aby šel měřit).
  //
  //     Indikátor +/× se řídí stejným záměrem (třída .je-otevrena),
  //     aby se otáčel souběžně se sbalováním, ne až na jeho konci.
  // ------------------------------------------------------------
  if (!bezPohybu) {
    const otazky = document.querySelectorAll("details.faq-item");

    if (otazky.length) {
      const TRVANI = 300;
      const KRIVKA = "cubic-bezier(.22, .61, .36, 1)"; // jemné dojetí, bez pružení

      // Teprve teď přebírá indikátor JS — bez skriptu i při omezeném
      // pohybu zůstává v CSS navázaný na [open] (viz style.css).
      document.body.classList.add("faq-animovane");

      otazky.forEach((polozka) => {
        const spoustec = polozka.querySelector("summary");
        const obsah = polozka.querySelector(".faq-odpoved");
        if (!spoustec || !obsah) return;

        let cil = polozka.open;
        let animace = null;

        polozka.classList.toggle("je-otevrena", cil);
        spoustec.setAttribute("aria-expanded", String(cil));

        spoustec.addEventListener("click", (udalost) => {
          udalost.preventDefault();

          cil = !cil;

          // Odkud pohyb pokračuje. Pozor: u zavřeného <details> vrací
          // Chrome pro obsah nenulovou výšku boxu (obsah jen přeskočí
          // vykreslení), takže se z ní vycházet nedá — při otevírání
          // proto startujeme natvrdo z nuly. Běžící animaci naopak
          // navážeme tam, kde se právě nachází, aby se plynule obrátila.
          let zVysky;
          if (animace) {
            zVysky = obsah.getBoundingClientRect().height;
            animace.onfinish = null; // ať doběhlý handler nepřepíše nový stav
            animace.cancel();
            animace = null;
          } else {
            zVysky = cil ? 0 : obsah.getBoundingClientRect().height;
          }

          // Obsah musí být v rozložení, jinak ho nelze změřit ani animovat
          polozka.open = true;
          polozka.classList.toggle("je-otevrena", cil);
          spoustec.setAttribute("aria-expanded", String(cil));

          const naVysku = cil ? obsah.scrollHeight : 0;
          obsah.style.height = naVysku + "px";

          animace = obsah.animate(
            {
              height: [zVysky + "px", naVysku + "px"],
              // prolnutí je jen doplněk, text se nikde nenatahuje
              opacity: [cil ? 0.4 : 1, cil ? 1 : 0.4],
            },
            { duration: TRVANI, easing: KRIVKA }
          );

          animace.onfinish = () => {
            animace = null;
            polozka.open = cil;   // zavřené <details> schová obsah i tabulátoru
            obsah.style.height = ""; // zpět na auto kvůli změnám šířky okna
            obsah.style.opacity = "";
          };
        });
      });
    }
  }

  // ------------------------------------------------------------
  // 4c. Zvětšenina fotografie z galerie
  //
  //     Jeden prvek na celou stránku, velká verze se do src doplní
  //     teprve při otevření — dokud nikdo nic nerozklikne, nestáhne
  //     se nic navíc. Zavření: křížek, klik mimo fotku, Escape.
  //     Zaměření se vrací na náhled, ze kterého se otevíralo.
  // ------------------------------------------------------------
  const lupa = document.getElementById("lupa");
  const lupaFoto = lupa && lupa.querySelector(".lupa-foto");
  const lupaZavrit = lupa && lupa.querySelector(".lupa-zavrit");
  const nahledy = document.querySelectorAll(".galerie-grid .zvetsit");

  if (lupa && lupaFoto && lupaZavrit && nahledy.length) {
    let puvodniFokus = null;

    const otevri = (tlacitko) => {
      const nahled = tlacitko.querySelector("img");
      puvodniFokus = tlacitko;

      lupa.classList.remove("je-nactena");
      lupaFoto.alt = nahled ? nahled.alt : "";
      lupaFoto.src = tlacitko.dataset.velka;
      lupa.hidden = false;
      // Stránka pod zvětšeninou nescrolluje; scrollbar-gutter: stable
      // v CSS drží šířku, takže se nic nepřeskládá.
      document.body.style.overflow = "hidden";
      lupaZavrit.focus();

      if (lupaFoto.complete && lupaFoto.naturalWidth) {
        lupa.classList.add("je-nactena");
      }
    };

    const zavri = () => {
      lupa.hidden = true;
      lupa.classList.remove("je-nactena");
      lupaFoto.removeAttribute("src"); // ať se velká verze neschovává v paměti
      document.body.style.overflow = "";
      if (puvodniFokus) {
        puvodniFokus.focus(); // návrat přesně tam, odkud se otevíralo
        puvodniFokus = null;
      }
    };

    lupaFoto.addEventListener("load", () => lupa.classList.add("je-nactena"));

    nahledy.forEach((tlacitko) => {
      tlacitko.addEventListener("click", () => otevri(tlacitko));
    });

    lupaZavrit.addEventListener("click", zavri);

    // Klik mimo fotku (na ztmavené pozadí) zavírá, klik na fotku ne
    lupa.addEventListener("click", (udalost) => {
      if (udalost.target === lupa) zavri();
    });

    document.addEventListener("keydown", (udalost) => {
      if (lupa.hidden) return;
      if (udalost.key === "Escape") {
        zavri();
      } else if (udalost.key === "Tab") {
        // Jediný ovladatelný prvek uvnitř je křížek — držíme fokus u něj,
        // ať se tabulátorem nedá odejít na skrytou stránku pod zvětšeninou.
        udalost.preventDefault();
        lupaZavrit.focus();
      }
    });
  }

  // ------------------------------------------------------------
  // 4d. Rozlitá barva ze vzorníku „Co na sebe"
  //
  //     Klepnutí na kaňku rozlije její barvu po displeji, aby šla
  //     porovnat s látkou v ruce.
  //
  //     Tvar nedělá `border-radius` ani transformace — ty umí jen
  //     zvětšit jeden a týž ovál. Vrstva je proto vybarvená celá
  //     a viditelný tvar z ní vyřízne `clip-path: polygon(...)`.
  //
  //     Jak vzniká pohyb okraje:
  //     Každá barva má předem nakreslený profil — dvanáct řídicích
  //     směrů po obvodu, v každém dosah okraje (`tvar`) a čas, kdy se
  //     v tom směru rozjede (`zpozdeni`). Mezi řídicími směry se
  //     interpoluje Catmull-Romem, takže obrys nemá rohy. Protože má
  //     každý směr jiné zpoždění i jinak dlouhý zbytek času, postupují
  //     části okraje s odstupem a různou rychlostí — nahoře dřív, dolů
  //     nejpozději. Odtud ten dojem rozlévání, ne zvětšování.
  //
  //     Průběh: do 16 % času se jen nepatrně rozšíří okraj puntíku,
  //     pak se rozjedou jednotlivé směry, růst se zpomaluje (mocnina
  //     2,6) a v cíli se zastaví. Po dokončení se nic nevlní.
  //
  //     Zavření: klepnutí kamkoli nebo Escape. `reverse()` přehraje
  //     tytéž snímky pozpátku včetně pozadí, takže přerušení uprostřed
  //     navazuje na aktuální tvar bez skoku.
  // ------------------------------------------------------------
  const barvaLupa = document.getElementById("barvaLupa");
  const barvaVzorek = barvaLupa && barvaLupa.querySelector(".barva-lupa-vzorek");
  const barvaSklo = barvaLupa && barvaLupa.querySelector(".barva-lupa-sklo");
  const kanky = document.querySelectorAll(".palette .kanka");

  if (barvaLupa && barvaVzorek && barvaSklo && kanky.length) {
    const SMERU = 12;     // řídicí směry profilu (index 0 = vzhůru, po směru hodin)
    const BODU = 56;      // body výsledného mnohoúhelníku
    const SNIMKU = 22;    // kolik mezitvarů dostane animace
    const TRVANI = 1400;
    const NAFOUKNUTI = 0.55; // o kolik se na začátku rozšíří okraj puntíku

    // Předkreslené profily — pro každou barvu jiný, ale stejného rázu:
    // nahoře nejdál, do stran méně, dolů nejméně, s několika širokými
    // vyklenutími a mělkými prohlubněmi. `zpozdeni` je podíl celkového
    // času, než se daný směr rozjede.
    const PROFILY = [
      // čokoládová — vyklenutí vlevo nahoře, mělká prohlubeň vpravo
      { tvar:      [1.10, 1.00, 0.78, 0.63, 0.58, 0.52, 0.48, 0.54, 0.64, 0.80, 0.99, 1.12],
        zpozdeni:  [0.10, 0.13, 0.19, 0.27, 0.33, 0.37, 0.38, 0.34, 0.26, 0.19, 0.14, 0.11] },
      // šedobéžová — rameno vpravo nahoře, útlum vlevo dole
      { tvar:      [1.06, 1.14, 0.98, 0.74, 0.58, 0.50, 0.47, 0.53, 0.60, 0.66, 0.80, 1.00],
        zpozdeni:  [0.11, 0.10, 0.17, 0.25, 0.32, 0.36, 0.38, 0.33, 0.27, 0.21, 0.15, 0.12] },
      // lesní zelená — vysoká špička nahoře a druhé vyklenutí vlevo dole
      { tvar:      [1.16, 1.02, 0.86, 0.70, 0.52, 0.50, 0.49, 0.58, 0.72, 0.78, 0.90, 1.06],
        zpozdeni:  [0.10, 0.15, 0.20, 0.24, 0.30, 0.36, 0.38, 0.35, 0.28, 0.18, 0.13, 0.11] },
      // kobaltová — široké rameno vpravo, prohlubeň vlevo dole
      { tvar:      [1.04, 1.08, 0.96, 0.78, 0.62, 0.52, 0.46, 0.50, 0.56, 0.70, 0.86, 1.00],
        zpozdeni:  [0.12, 0.14, 0.18, 0.26, 0.34, 0.37, 0.38, 0.32, 0.24, 0.20, 0.16, 0.10] },
      // modrošedá — plnější levý bok, štíhlejší pravý
      { tvar:      [1.12, 0.98, 0.80, 0.66, 0.56, 0.50, 0.48, 0.56, 0.70, 0.84, 0.98, 1.08],
        zpozdeni:  [0.10, 0.14, 0.21, 0.26, 0.31, 0.35, 0.38, 0.34, 0.25, 0.19, 0.14, 0.11] }
    ];

    // Hladká interpolace po uzavřeném obvodu — bez rohů mezi řídicími směry
    const catmull = (pole, misto) => {
      const n = pole.length;
      const i = Math.floor(misto);
      const t = misto - i;
      const p0 = pole[(i - 1 + n) % n], p1 = pole[i % n];
      const p2 = pole[(i + 1) % n], p3 = pole[(i + 2) % n];
      return 0.5 * ((2 * p1) + (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
    };

    const mezi = (v, a, b) => Math.min(Math.max(v, a), b);
    const hladce = (v) => v * v * (3 - 2 * v); // klidný náběh i dojezd

    // Dosah okraje v daném směru a čase. `uhel` 0 = vzhůru.
    const polomer = (uhel, cas, profil, dosah, nafoukly) => {
      let misto = ((uhel + Math.PI / 2) / (Math.PI * 2)) * SMERU;
      misto = ((misto % SMERU) + SMERU) % SMERU;
      const cilovy = dosah * catmull(profil.tvar, misto);
      const zpozdeni = catmull(profil.zpozdeni, misto);
      const mistni = mezi((cas - zpozdeni) / (1 - zpozdeni), 0, 1);
      // Dojezd s nulovou rychlostí — tvar se v cíli klidně ustálí
      const postup = 1 - Math.pow(1 - mistni, 2.6);
      return nafoukly + (cilovy - nafoukly) * postup;
    };

    // Jeden snímek obrysu v čase `cas` (0–1) jako `polygon()`
    const obrys = (cas, profil, zacatek, rPuntiku, cil, dosah) => {
      const sirka = window.innerWidth;
      const vyska = window.innerHeight;

      // Nepatrné rozšíření okraje hned na začátku, než se rozjedou směry
      const nafoukly = rPuntiku * (1 + NAFOUKNUTI * hladce(mezi(cas / 0.16, 0, 1)));

      // Nejdřív jen odstupy od středu — absolutní polohu dopočítáme až
      // z nich, aby šlo kaňku spolehlivě udržet na displeji.
      const odstupy = [];
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < BODU; i++) {
        const uhel = (i / BODU) * Math.PI * 2 - Math.PI / 2; // 0 = vzhůru
        const r = polomer(uhel, cas, profil, dosah, nafoukly);
        const dx = Math.cos(uhel) * r;
        const dy = Math.sin(uhel) * r;
        odstupy.push([dx, dy]);
        if (dx < minX) minX = dx;
        if (dx > maxX) maxX = dx;
        if (dy < minY) minY = dy;
        if (dy > maxY) maxY = dy;
      }

      // Střed putuje od puntíku k cíli. Stěhuje se pozvolna a se
      // zpožděním: kdyby vyrazil hned, ujel by vzhůru rychleji, než
      // stačí růst spodní okraj, a ten by chvíli couval — vypadalo by
      // to jako pulzování. Že kaňka u krajního puntíku nevyteče
      // z displeje, hlídá ořez níž, ne rychlost stěhování.
      const posun = hladce(mezi((cas - 0.10) / 0.62, 0, 1));
      let sx = zacatek.x + (cil.x - zacatek.x) * posun;
      let sy = zacatek.y + (cil.y - zacatek.y) * posun;

      // Dvě podmínky najednou: kaňka se vejde do okna a puntík zůstane
      // uvnitř ní. Obdélníkový ořez by na druhou nestačil — tvar není
      // konvexní, takže puntík může ležet uvnitř opsaného obdélníku
      // a přesto mimo obrys; porovnáváme proto vzdálenost přímo
      // s dosahem okraje v jeho směru.
      //
      // Podmínky se nedají splnit jedním průchodem: ořez na okno
      // odsune střed od krajního puntíku a přitažení k puntíku ho zas
      // vrátí ven. Střídáme je proto několikrát — obě množiny poloh
      // se překrývají, takže se to ustálí. Končíme přitažením, aby
      // ve sporu vyhrála souvislost kaňky s puntíkem.
      const vOkne = () => {
        sx = mezi(sx, 8 - minX, Math.max(8 - minX, sirka - 8 - maxX));
        sy = mezi(sy, 6 - minY, Math.max(6 - minY, vyska - 6 - maxY));
      };
      const kPuntiku = () => {
        const vx = zacatek.x - sx;
        const vy = zacatek.y - sy;
        const vzdalenost = Math.hypot(vx, vy);
        if (vzdalenost < 1) return;
        const dovoleno = polomer(Math.atan2(vy, vx), cas, profil, dosah, nafoukly) * 0.86;
        if (vzdalenost <= dovoleno) return;
        const krok = (vzdalenost - dovoleno) / vzdalenost;
        sx += vx * krok;
        sy += vy * krok;
      };
      for (let k = 0; k < 4; k++) { vOkne(); kPuntiku(); }

      const body = [];
      for (let i = 0; i < BODU; i++) {
        const x = sx + odstupy[i][0];
        const y = sy + odstupy[i][1];
        body.push(((x / sirka) * 100).toFixed(2) + "% " + ((y / vyska) * 100).toFixed(2) + "%");
      }
      return "polygon(" + body.join(", ") + ")";
    };

    let animaceTvar = null;
    let animaceSklo = null;
    let aktivniKanka = null;
    let otevreno = false;

    const snimky = (kanka, poradi) => {
      const p = kanka.getBoundingClientRect();
      const zacatek = { x: p.left + p.width / 2, y: p.top + p.height / 2 };
      const rPuntiku = p.width / 2;
      const profil = PROFILY[poradi % PROFILY.length];

      const sirka = window.innerWidth;
      const vyska = window.innerHeight;

      // Největší dosah v jednotlivých směrech podle profilu
      let nahoru = 0, dolu = 0, doStran = 0;
      for (let i = 0; i < BODU; i++) {
        const uhel = (i / BODU) * Math.PI * 2 - Math.PI / 2;
        const v = catmull(profil.tvar, (i / BODU) * SMERU);
        nahoru = Math.max(nahoru, -Math.sin(uhel) * v);
        dolu = Math.max(dolu, Math.sin(uhel) * v);
        doStran = Math.max(doStran, Math.abs(Math.cos(uhel)) * v);
      }

      // Dosah volíme tak, aby se celý obrys vešel na displej
      const dosah = Math.min(
        (sirka / 2 - 10) / doStran,
        (vyska - 20) / (nahoru + dolu),
        vyska * 0.34
      );

      // Svislá poloha: barva má postoupit hlavně vzhůru, ale puntík
      // musí po celou dobu zůstat uvnitř kaňky.
      const chteny = zacatek.y - dosah * 0.18;
      const nejvys = dosah * nahoru + 10;
      const nejniz = vyska - dosah * dolu - 10;
      let stredY = mezi(chteny, nejvys, Math.max(nejvys, nejniz));
      stredY = Math.min(stredY, zacatek.y + dosah * nahoru - rPuntiku - 4);
      stredY = Math.max(stredY, zacatek.y - dosah * dolu * 0.62);

      const cil = { x: sirka / 2, y: stredY };

      const kroky = [];
      for (let i = 0; i < SNIMKU; i++) {
        const cas = i / (SNIMKU - 1);
        kroky.push({ clipPath: obrys(cas, profil, zacatek, rPuntiku, cil, dosah), offset: cas });
      }
      return kroky;
    };

    const uklid = () => {
      barvaLupa.hidden = true;
      document.body.style.overflow = "";
      if (aktivniKanka) { aktivniKanka.focus({ preventScroll: true }); aktivniKanka = null; }
      if (animaceTvar) { animaceTvar.cancel(); animaceTvar = null; }
      if (animaceSklo) { animaceSklo.cancel(); animaceSklo = null; }
    };

    const otevri = (kanka, poradi) => {
      // Běží-li zrovna stažení téže kaňky, stačí ho obrátit zpátky
      if (animaceTvar && aktivniKanka === kanka && animaceTvar.playbackRate < 0) {
        animaceTvar.reverse();
        if (animaceSklo) animaceSklo.reverse();
        otevreno = true;
        return;
      }
      if (animaceTvar) { animaceTvar.onfinish = null; animaceTvar.cancel(); animaceTvar = null; }
      if (animaceSklo) { animaceSklo.cancel(); animaceSklo = null; }

      const polozka = kanka.closest("li");
      aktivniKanka = kanka;
      otevreno = true;

      barvaVzorek.style.setProperty("--c", getComputedStyle(polozka).getPropertyValue("--c").trim());
      barvaLupa.setAttribute("aria-label", "Barva: " + kanka.textContent.trim());
      barvaLupa.hidden = false;
      document.body.style.overflow = "hidden"; // stránka pod sklem nescrolluje
      // `preventScroll` je tu nutné: vrstva je přes celé okno a fokus
      // bez něj stáhne stránku pod ní jinam — po zavření by uživatel
      // skončil na jiném místě, než odkud klepl.
      barvaLupa.focus({ preventScroll: true });

      const kroky = snimky(kanka, poradi);

      if (bezPohybu) {
        // Při systémovém omezení animací jen nasadíme konečný tvar
        barvaVzorek.style.setProperty("--tvar", kroky[kroky.length - 1].clipPath);
        return;
      }

      barvaVzorek.style.removeProperty("--tvar");
      // Časování nese samotná posloupnost snímků, proto mezi nimi
      // interpolujeme rovnoměrně — jinak by se křivky skládaly.
      animaceTvar = barvaVzorek.animate(kroky, { duration: TRVANI, easing: "linear", fill: "both" });
      // Stejně dlouhá osa jako u tvaru, aby `reverse()` vrátil obojí
      // v souladu; sklo jen náběhne dřív a pak drží.
      animaceSklo = barvaSklo.animate(
        [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.45 }, { opacity: 1, offset: 1 }],
        { duration: TRVANI, easing: "linear", fill: "both" });
    };

    const zavri = () => {
      if (!otevreno) return;
      otevreno = false;

      if (!animaceTvar) { uklid(); return; }

      // Obrácení běžící i doběhlé osy — v obou případech navazuje
      // přesně na tvar, ve kterém se pohyb právě nachází.
      animaceTvar.reverse();
      if (animaceSklo) animaceSklo.reverse();
      animaceTvar.onfinish = () => {
        if (otevreno) return; // mezitím někdo klepl znovu
        uklid();
      };
    };

    kanky.forEach((kanka, poradi) => {
      kanka.addEventListener("click", () => otevri(kanka, poradi));
    });

    // Klepnutí kamkoli po vrstvě zavírá — celá plocha je jedno gesto
    barvaLupa.addEventListener("click", zavri);

    document.addEventListener("keydown", (udalost) => {
      if (barvaLupa.hidden) return;
      if (udalost.key === "Escape") {
        zavri();
      } else if (udalost.key === "Tab") {
        // Uvnitř není co ovládat — fokus zůstává na vrstvě, ať se
        // tabulátorem nedá odejít na stránku schovanou pod sklem.
        udalost.preventDefault();
        // `preventScroll` je tu nutné: vrstva je přes celé okno a fokus
      // bez něj stáhne stránku pod ní jinam — po zavření by uživatel
      // skončil na jiném místě, než odkud klepl.
      barvaLupa.focus({ preventScroll: true });
      }
    });
  }

  // ------------------------------------------------------------
  // 5. Mobilní menu (hamburger)
  // ------------------------------------------------------------
  const burger = document.querySelector(".nav-burger");
  const menu = document.querySelector(".menu");

  if (burger && menu) {
    const prepniMenu = (otevrit) => {
      menu.classList.toggle("open", otevrit);
      burger.classList.toggle("open", otevrit);
      burger.setAttribute("aria-expanded", String(otevrit));
      burger.setAttribute("aria-label", otevrit ? "Zavřít menu" : "Otevřít menu");
      document.body.classList.toggle("menu-otevrene", otevrit);
      document.body.style.overflow = otevrit ? "hidden" : ""; // zámek scrollu
    };

    burger.addEventListener("click", () => {
      prepniMenu(!menu.classList.contains("open"));
    });

    // Klik na kapitolu menu zavře a nechá prohlížeč doscrollovat
    menu.querySelectorAll("a").forEach((odkaz) => {
      odkaz.addEventListener("click", () => prepniMenu(false));
    });
  }

  // ------------------------------------------------------------
  // 6. Zvýraznění aktivní kapitoly v desktopové navigaci
  // ------------------------------------------------------------
  if ("IntersectionObserver" in window) {
    const odkazy = document.querySelectorAll(".nav-links a[href^='#']");
    if (odkazy.length) {
      const spy = new IntersectionObserver((zaznamy) => {
        zaznamy.forEach((z) => {
          const odkaz = document.querySelector(
            `.nav-links a[href="#${z.target.id}"]`
          );
          if (odkaz) odkaz.classList.toggle("active", z.isIntersecting);
        });
      }, { rootMargin: "-40% 0px -55% 0px" }); // aktivní = kapitola u středu okna

      odkazy.forEach((odkaz) => {
        const cil = document.querySelector(odkaz.getAttribute("href"));
        if (cil) spy.observe(cil);
      });
    }
  }
});
