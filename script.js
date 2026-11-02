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
  //     porovnat s látkou v ruce. Dalším klepnutím se stáhne zpět.
  //
  //     JEN NA DOTYKOVÝCH ZAŘÍZENÍCH. S myší zůstává u vzorníku pouze
  //     zvětšení kaňky při najetí — rozlití přes celý displej je gesto
  //     pro telefon v ruce, ne pro desktop. Stejnou podmínku drží
  //     i styl (`cursor` u `.kanka`), aby se obojí nikdy nepřekrývalo.
  //
  //     Tvar nedělá `border-radius` ani transformace — ty umí jen
  //     zvětšit jeden a týž ovál. Vrstva je proto vybarvená celá
  //     a viditelný tvar z ní vyřízne `clip-path: polygon(...)`.
  //
  //     JAK VZNIKÁ OBRYS
  //     Obrys je změkčené sjednocení laloků — sedmi překrývajících se
  //     kruhů rozmístěných nad puntíkem. Spodní lalok se dotýká jeho
  //     spodní hrany a v čase 0 je přesně puntíkem. Z té konstrukce
  //     plyne trojí:
  //       · každý bod obrysu leží na některé kružnici, takže temeno
  //         ani dno nemůže být špička — ani uprostřed růstu, ani těsně
  //         před návratem do puntíku,
  //       · dno je oblouk širokého spodního laloku, ne úzká stopka,
  //       · styky laloků se slévají polynomiálním smooth-maxem, takže
  //         obrys má široká vyklenutí a jen mělké prohlubně.
  //     Jednotlivé laloky se rozjíždějí v různý čas, proto se mezitvary
  //     liší obrysem, ne jen velikostí.
  //
  //     Dvě cesty, které sem nevedou (ať se k nim nikdo nevrací):
  //     radiální profil kolem volně stěhovaného středu — puntík v něm
  //     plave a barva z něj zjevně nevytéká; a svislý stoh kotoučů —
  //     poloměr se po výšce mění rychleji, než se posouvá střed, obálka
  //     vůbec nevznikne a největší kotouč pohltí tvar do oválu.
  //
  //     JAK VZNIKÁ POHYB
  //     Žádné zapečené snímky: každý snímek se počítá ze ŽIVÉ polohy
  //     puntíku a živých rozměrů vrstvy. Dřív byly mezitvary napečené
  //     do WAAPI při otevření, takže když mezitím vyjela lišta mobilního
  //     prohlížeče, procenta v `polygon()` začala znamenat jinou výšku
  //     a při zavírání se pod paletou objevil zbytkový tvar mimo puntík.
  //     Teď se obrys dopočítává v `requestAnimationFrame`, takže posun
  //     stránky i změna viditelné výšky jsou samy od sebe v pořádku.
  //     Obrácení kdykoli během růstu je jen změna znaménka směru —
  //     pohyb navazuje na aktuální tvar bez skoku.
  // ------------------------------------------------------------
  const barvaLupa = document.getElementById("barvaLupa");
  const barvaVzorek = barvaLupa && barvaLupa.querySelector(".barva-lupa-vzorek");
  const barvaSklo = barvaLupa && barvaLupa.querySelector(".barva-lupa-sklo");
  const kanky = document.querySelectorAll(".palette .kanka");

  if (barvaLupa && barvaVzorek && barvaSklo && kanky.length) {
    const RADKU = 64;     // vodorovných řezů obrysu
    const TRVANI = 1500;  // ms

    // Lalok = [posun x, posun y (záporné = vzhůru), poloměr, zpoždění],
    // první tři v násobcích `sirka`, zpoždění jako podíl délky animace.
    // Pořadí odpovídá pořadí kaněk v paletě.
    const LALOKY = [
      // čokoládová
      [[ 0.00,  0.00, 0.62, 0.00], [-0.26, -0.48, 0.68, 0.09], [ 0.30, -0.42, 0.58, 0.17],
       [-0.02, -0.96, 0.70, 0.30], [ 0.34, -1.22, 0.50, 0.46], [-0.38, -1.18, 0.54, 0.55],
       [ 0.04, -1.50, 0.42, 0.68]],
      // šedobéžová
      [[ 0.00,  0.00, 0.64, 0.00], [ 0.28, -0.46, 0.66, 0.08], [-0.30, -0.40, 0.56, 0.18],
       [ 0.06, -0.92, 0.72, 0.29], [-0.36, -1.20, 0.52, 0.45], [ 0.34, -1.24, 0.50, 0.56],
       [-0.02, -1.54, 0.40, 0.69]],
      // lesní zelená
      [[ 0.00,  0.00, 0.60, 0.00], [-0.22, -0.52, 0.64, 0.10], [ 0.32, -0.40, 0.62, 0.15],
       [ 0.02, -0.98, 0.68, 0.31], [-0.34, -1.14, 0.56, 0.44], [ 0.30, -1.28, 0.48, 0.57],
       [-0.06, -1.56, 0.44, 0.70]],
      // kobaltová
      [[ 0.00,  0.00, 0.66, 0.00], [ 0.24, -0.50, 0.62, 0.09], [-0.32, -0.44, 0.60, 0.16],
       [-0.04, -0.94, 0.70, 0.30], [ 0.36, -1.18, 0.52, 0.47], [-0.30, -1.26, 0.50, 0.54],
       [ 0.06, -1.52, 0.42, 0.68]],
      // modrošedá
      [[ 0.00,  0.00, 0.62, 0.00], [-0.28, -0.44, 0.60, 0.08], [ 0.26, -0.52, 0.66, 0.17],
       [ 0.04, -1.00, 0.68, 0.30], [-0.32, -1.22, 0.54, 0.46], [ 0.32, -1.20, 0.50, 0.55],
       [-0.04, -1.50, 0.44, 0.69]]
    ];

    const mezi = (v, a, b) => Math.min(Math.max(v, a), b);

    // Polynomiální měkké maximum/minimum — styk dvou laloků se slije
    // v plynulý oblouk místo ostrého zářezu.
    const mekkeMax = (a, b, k) => {
      if (k <= 0) return Math.max(a, b);
      const h = mezi(0.5 + 0.5 * (a - b) / k, 0, 1);
      return (b * (1 - h) + a * h) + k * h * (1 - h);
    };
    const mekkeMin = (a, b, k) => -mekkeMax(-a, -b, k);

    // Jak daleko lalok postoupil. Spodní se rozjede hned, horní později
    // — barva tím viditelně stoupá.
    const postup = (zpozdeni, cas) => {
      const rozsah = 0.42 + 0.34 * (1 - mezi(zpozdeni / 0.7, 0, 1));
      const mistni = mezi((cas - zpozdeni) / rozsah, 0, 1);
      if (mistni <= 0) return 0;
      return 1 - Math.pow(1 - mistni, 2.4);
    };

    // Jeden snímek obrysu. `puntik` i `okno` se předávají ze živého
    // rozvržení, takže změna výšky plochy uprostřed animace nic nerozhodí.
    const obrys = (cas, laloky, puntik, okno) => {
      const L = laloky;
      const dno = puntik.y + puntik.r;   // spodní hrana puntíku — pevná kotva
      const stred = okno.w / 2;

      // Měřítko: tvar se musí vejít do plochy i s krajními laloky
      let doleva = 0, doprava = 0, nahoru = 0, nejvyssi = 1;
      for (let m = 0; m < L.length; m++) {
        doleva = Math.max(doleva, L[m][2] - L[m][0]);
        doprava = Math.max(doprava, L[m][2] + L[m][0]);
        nahoru = Math.max(nahoru, L[m][2] - L[m][1]);
        nejvyssi = Math.max(nejvyssi, -L[m][1]);
      }
      let sirka = Math.min(
        (okno.w - 24) / (doleva + doprava),
        (dno - 8) / (L[0][2] + nahoru)
      );
      sirka = Math.max(sirka, puntik.r * 1.4);

      // Kaňka u krajního puntíku se naklání do plochy, aby se měla kam
      // rozlít. Naklonění roste s výškou, ale i spodní lalok musí uhnout —
      // jinak by nad ním tělo odjelo stranou a mezi nimi by vznikl krk.
      const naklon = stred - puntik.x;
      const osa = (i, g) => puntik.x + sirka * L[i][0] * g
        + naklon * (0.30 + 0.45 * (-L[i][1] / nejvyssi)) * g;

      // Spodní lalok: dno drží u spodní hrany puntíku. Aby mohl uhnout
      // do strany a puntík v něm přesto zůstal celý, smí o kousek
      // přesáknout pod něj; z velikosti přesaku plyne dovolený posun
      // (podmínka, že kružnice obsahuje celý puntík). Poloměr se
      // dopočítává ve třech krocích, protože omezení plochy a posunu se
      // navzájem ovlivňují.
      const g0 = postup(L[0][3], cas);
      let r0 = Math.max(puntik.r, sirka * L[0][2] * g0);
      const presak = Math.min(sirka * 0.06 * g0, puntik.r * 0.7);
      let x0 = puntik.x;
      for (let k = 0; k < 3; k++) {
        const zapas = r0 - puntik.r;
        const posunMax = zapas > 0 ? Math.sqrt(Math.max(0, presak * (2 * zapas - presak))) : 0;
        x0 = puntik.x + mezi(osa(0, g0) - puntik.x, -posunMax, posunMax);
        const mozne = Math.max(puntik.r, Math.min(x0 - 12, okno.w - 12 - x0));
        if (r0 > mozne) r0 = mozne; else break;
      }
      const y0 = dno + presak - r0;

      const kruhy = [{ x: puntik.x, y: puntik.y, r: puntik.r }];  // vždy i puntík sám
      kruhy.push({ x: x0, y: y0, r: r0 });
      for (let i = 1; i < L.length; i++) {
        const g = postup(L[i][3], cas);
        if (g <= 0) continue;
        const r = sirka * L[i][2] * g;
        const y = y0 + sirka * (L[i][1] - L[0][1]) * g;
        let x = osa(i, g);
        if (12 + r <= okno.w - 12 - r) x = mezi(x, 12 + r, okno.w - 12 - r);
        kruhy.push({ x, y, r });
      }

      let vrch = Infinity, spod = -Infinity;
      for (let k = 0; k < kruhy.length; k++) {
        vrch = Math.min(vrch, kruhy[k].y - kruhy[k].r);
        spod = Math.max(spod, kruhy[k].y + kruhy[k].r);
      }
      const slitek = Math.min(sirka * 0.10, (spod - vrch) * 0.07);

      // Vodorovné řezy; kosinové rozložení zahustí vzorky u dna a temene,
      // kde je obrys vodorovný a rovnoměrné řezy by z něj udělaly schod.
      const vpravo = [], vlevo = [];
      for (let j = 0; j <= RADKU; j++) {
        const y2 = spod - (spod - vrch) * (1 - Math.cos((j / RADKU) * Math.PI)) / 2;
        let xl = null, xr = null;
        for (let n = 0; n < kruhy.length; n++) {
          const d = y2 - kruhy[n].y;
          let pp = kruhy[n].r * kruhy[n].r - d * d;
          if (pp <= 0) continue;
          pp = Math.sqrt(pp);
          const kk = Math.min(slitek, pp);
          xr = xr === null ? kruhy[n].x + pp : mekkeMax(xr, kruhy[n].x + pp, kk);
          xl = xl === null ? kruhy[n].x - pp : mekkeMin(xl, kruhy[n].x - pp, kk);
        }
        if (xl === null) { xl = xr = kruhy[0].x; }
        vpravo.push([xr, y2]);
        vlevo.push([xl, y2]);
      }

      const kusy = [];
      const pridej = (b) => kusy.push(
        ((b[0] / okno.w) * 100).toFixed(2) + "% " + ((b[1] / okno.h) * 100).toFixed(2) + "%");
      for (let a = 0; a < vpravo.length; a++) pridej(vpravo[a]);
      for (let b = vlevo.length - 1; b >= 0; b--) pridej(vlevo[b]);
      return "polygon(" + kusy.join(", ") + ")";
    };

    // --- běh animace -------------------------------------------------
    let aktivniKanka = null;
    let aktivniLaloky = LALOKY[0];
    let cas = 0;        // 0 = puntík, 1 = rozlitá kaňka
    let smer = 0;       // +1 rozlévá, -1 stahuje
    let bezi = false;
    let minule = 0;

    // Rozměry se čtou ze živého rozvržení při KAŽDÉM snímku — právě
    // proto vyjetí lišty prohlížeče ani posun stránky nerozhodí návrat.
    const rozmery = () => {
      const r = barvaLupa.getBoundingClientRect();
      const p = aktivniKanka.getBoundingClientRect();
      return {
        okno: { w: r.width, h: r.height },
        puntik: {
          x: p.left - r.left + p.width / 2,
          y: p.top - r.top + p.height / 2,
          r: p.width / 2
        }
      };
    };

    const vykresli = () => {
      if (!aktivniKanka) return;
      const m = rozmery();
      if (!m.okno.w || !m.okno.h) return;
      barvaVzorek.style.setProperty("--tvar", obrys(cas, aktivniLaloky, m.puntik, m.okno));
      barvaSklo.style.opacity = String(mezi(cas / 0.45, 0, 1));
    };

    const uklid = () => {
      barvaLupa.hidden = true;
      document.body.style.overflow = "";
      barvaVzorek.style.removeProperty("--tvar");
      barvaSklo.style.opacity = "0";
      if (aktivniKanka) { aktivniKanka.focus({ preventScroll: true }); aktivniKanka = null; }
    };

    const jed = (novySmer) => {
      smer = novySmer;
      if (bezPohybu) {   // systémové omezení animací: rovnou cílový stav
        cas = smer > 0 ? 1 : 0;
        vykresli();
        if (cas === 0) uklid();
        return;
      }
      if (bezi) return;  // směr si běžící smyčka přečte sama
      bezi = true;
      minule = performance.now();
      const tik = (ted) => {
        cas = mezi(cas + smer * ((ted - minule) / TRVANI), 0, 1);
        minule = ted;
        vykresli();
        if ((smer > 0 && cas < 1) || (smer < 0 && cas > 0)) {
          requestAnimationFrame(tik);
        } else {
          bezi = false;
          if (cas === 0) uklid();
        }
      };
      requestAnimationFrame(tik);
    };

    const otevri = (kanka, poradi) => {
      // Totéž klepnutí na už rozlitou kaňku znamená „stáhni zpět"
      if (aktivniKanka === kanka && !barvaLupa.hidden && smer >= 0) { jed(-1); return; }

      const polozka = kanka.closest("li");
      // Jiná barva během běhu: pohyb pokračuje z aktuálního tvaru,
      // jen se překreslí nad nový puntík — žádný skok na začátek.
      aktivniKanka = kanka;
      aktivniLaloky = LALOKY[poradi % LALOKY.length];
      barvaVzorek.style.setProperty("--c", getComputedStyle(polozka).getPropertyValue("--c").trim());
      barvaLupa.setAttribute("aria-label", "Barva: " + kanka.textContent.trim());
      if (barvaLupa.hidden) { cas = 0; barvaLupa.hidden = false; }
      document.body.style.overflow = "hidden"; // stránka pod sklem nescrolluje
      // `preventScroll` je tu nutné: vrstva je přes celé okno a fokus
      // bez něj stáhne stránku pod ní jinam — po zavření by uživatel
      // skončil na jiném místě, než odkud klepl.
      barvaLupa.focus({ preventScroll: true });
      vykresli();
      jed(1);
    };

    const zavri = () => {
      if (barvaLupa.hidden) return;
      jed(-1);
    };

    // Dotykové zařízení poznáme stejně jako styl: chybí najíždění myší,
    // nebo je hlavní ukazovátko hrubé (prst). Vyhodnocuje se při každém
    // klepnutí, takže připojení myši k tabletu nebo přepnutí v nástrojích
    // prohlížeče se projeví hned a není potřeba znovu načítat stránku.
    const dotykove = window.matchMedia("(hover: none), (pointer: coarse)");

    kanky.forEach((kanka, poradi) => {
      kanka.addEventListener("click", (udalost) => {
        if (!dotykove.matches) return; // s myší zůstává jen zvětšení při najetí
        udalost.stopPropagation();
        otevri(kanka, poradi);
      });
    });

    // Kdyby se zařízení změnilo s rozlitou barvou na displeji, vrstva by
    // zůstala viset bez možnosti ji klepnutím zavřít — zavřeme ji sami.
    const zmenaZarizeni = () => {
      if (dotykove.matches || barvaLupa.hidden) return;
      smer = -1;
      cas = 0;
      uklid();
    };
    if (dotykove.addEventListener) dotykove.addEventListener("change", zmenaZarizeni);
    else if (dotykove.addListener) dotykove.addListener(zmenaZarizeni); // starší Safari

    // Klepnutí kamkoli po vrstvě zavírá — celá plocha je jedno gesto
    barvaLupa.addEventListener("click", zavri);

    // Tah prstem po vrstvě nic neposouvá. Samotné `overflow: hidden`
    // na <body> na iOS nestačí a stránka pod vrstvou by odjela.
    barvaLupa.addEventListener("touchmove", (udalost) => udalost.preventDefault(),
      { passive: false });

    // Změna rozměrů okna (vyjetí lišty, otočení telefonu) jen překreslí
    // aktuální snímek; poloha puntíku se čte znovu, takže tvar zůstane
    // na něm i v klidovém stavu mezi dvěma pohyby.
    window.addEventListener("resize", () => { if (!barvaLupa.hidden) vykresli(); });

    document.addEventListener("keydown", (udalost) => {
      if (barvaLupa.hidden) return;
      if (udalost.key === "Escape") {
        zavri();
      } else if (udalost.key === "Tab") {
        // Uvnitř není co ovládat — fokus zůstává na vrstvě, ať se
        // tabulátorem nedá odejít na stránku schovanou pod sklem.
        udalost.preventDefault();
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
