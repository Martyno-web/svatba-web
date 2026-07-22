// ============================================================
// Svatební web — JavaScript
// Vše je "progressive enhancement": bez JS web plně funguje,
// jen chybí odpočet a animace.
// ============================================================

const bezPohybu = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.addEventListener("DOMContentLoaded", () => {

  // ------------------------------------------------------------
  // 0. Úvodní přechod (M & M jako rostoucí díra do hero)
  //
  //    Jedna hodnota "progress" na animační snímek řídí VŠE — žádné
  //    dvě nezávislé CSS animace, žádné spoléhání na to, že CSS
  //    animace na sdíleném zdroji uvnitř <defs> se spolehlivě
  //    propíše do obou <use> instancí (v praxi se to neukázalo
  //    spolehlivé). Místo toho na každém snímku:
  //    1) spočítáme JEDEN řetězec SVG transformace (translate → scale
  //       → translate zpět, střed z getBoundingClientRect skutečné
  //       intro karty) a nastavíme ho na introVisibleUse i introMaskUse
  //       — identicky, žádný odhad,
  //    2) podle SKUTEČNÉHO uplynulého času (ne podle "eased" scale
  //       hodnoty) plynule prolneme viditelnou literu do průhledné,
  //    3) v závěrečné fázi ZÁROVEŇ s pokračujícím scale necháme
  //       plynule růst dilataci a jemný feather na filtru
  //       #introFeather aplikovaném na #introMaskUse — díra se tak
  //       měkce rozpíná ven z obrysů TÉHOŽ tvaru, žádná druhá geometrie
  //       a žádný tvrdý topologický skok.
  //
  //    JS jen navíc: (a) počká na web font, ať se tvar uprostřed
  //    neplete, (b) po dobu běhu zamkne scroll a schová navigaci/
  //    hero text/scroll-cue, (c) po dohrání intro odstraní z DOM,
  //    (d) při omezení pohybu nebo chybějící podpoře CSS masky
  //    přepne na jednoduché krátké prolnutí bez zoomu.
  // ------------------------------------------------------------
  const intro = document.getElementById("intro");
  if (intro) {
    const HOLD = 300;          // ms klidu na začátku (malé M&M v klidu)
    const DELKA_RUSTU = 2200;  // ms — samotný plynulý růst
    const CEKANI_NA_FONT = 400; // bezpečný strop, ať intro nečeká donekonečna

    const introVisibleUse = document.getElementById("introVisibleUse");
    const introMaskUse = document.getElementById("introMaskUse");
    const introDilate = document.getElementById("introDilate"); // feMorphology
    const introBlur = document.getElementById("introBlur");     // feGaussianBlur

    const maskySwPodporovane =
      typeof CSS !== "undefined" &&
      CSS.supports &&
      (CSS.supports("mask-image", "url(#x)") ||
        CSS.supports("-webkit-mask-image", "url(#x)"));

    const zjednodusit =
      bezPohybu ||
      !maskySwPodporovane ||
      !introVisibleUse ||
      !introMaskUse ||
      !introDilate ||
      !introBlur;

    document.body.classList.add("intro-running");

    const uklidit = () => {
      intro.remove();
      document.body.classList.remove("intro-running");
    };

    // Akcelerující křivka BEZ zpomalení na konci (na rozdíl od
    // ease-in-out, který k t=1 stahuje rychlost k nule — přesně to
    // způsobovalo dojem "zamrznutí" těsně před koncem). Start je
    // jemný (sklon 0 v t=0), rychlost od začátku do konce jen roste.
    const easeAkceleruj = (t) => Math.pow(t, 2.2);

    const animovat = () => {
      const rect = intro.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      // SCALE_MAX odvozený od skutečné velikosti obrazovky: cílem je,
      // aby ve chvíli, kdy se rozjede dilatace masky (t≈0,66), už
      // jednotlivé tahy "M & M" byly výrazně větší než viewport.
      // Odhad šířky nápisu při scale 1 = font-size × ~2,4 (poměr
      // "M & M" v použitém řezu). Výsledek omezen na 18–25.
      const fontSizePx =
        parseFloat(getComputedStyle(introMaskUse).fontSize) || 70;
      const logoSirka = fontSizePx * 2.4;
      const potrebnyScale =
        (Math.max(rect.width, rect.height) * 1.6) / logoSirka;
      const SCALE_MAX = Math.min(25, Math.max(18, potrebnyScale));

      // MAX_SCREEN_DILATE — v REÁLNÝCH OBRAZOVKOVÝCH PIXELECH, ne
      // v lokálních SVG jednotkách. Na rozdíl od stroke (ten lemoval
      // obrys na obě strany) je dilate čistě JEDNOSMĚRNÝ posun hranice
      // ven, takže dosah od (cx, cy) do nejvzdálenějšího rohu
      // viewportu (polovina úhlopříčky) stačí pokrýt přímo, s rezervou
      // ×1.3. Hodnota je záměrně nezávislá na SCALE_MAX — dělením
      // aktuálním scale (viz krok 3) se ruší multiplikativní efekt
      // transformace, který dřív způsoboval skokovou "explozi" masky.
      const uhloprickaPanelu = Math.hypot(rect.width, rect.height);
      const MAX_SCREEN_DILATE = (uhloprickaPanelu / 2) * 1.3;

      const zacatek = performance.now();

      const krok = (ted) => {
        const uplynulo = ted - zacatek;

        if (uplynulo < HOLD) {
          requestAnimationFrame(krok);
          return;
        }

        // t = reálný, lineární postup v čase (0–1) — na něm stavíme
        // časování crossfade i růstu dilatace/featheru, aby seděly na
        // skutečné sekundy, ne na zakřivenou "eased" škálu.
        const t = Math.min(1, (uplynulo - HOLD) / DELKA_RUSTU);
        const scale = 1 + (SCALE_MAX - 1) * easeAkceleruj(t);

        // 1) Jedna transformace, nastavená na OBĚ <use> zároveň —
        //    scale pokračuje plynule až do úplného konce (t=1),
        //    nikdy se nezastaví dřív, než skončí celá animace.
        const transform =
          `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`;
        introVisibleUse.setAttribute("transform", transform);
        introMaskUse.setAttribute("transform", transform);

        // 2) Crossfade viditelné litery — plynule mezi cca 0,9 s a 1,4 s
        //    reálného času (t≈0,27–0,50 uvnitř okna růstu)
        let opacity;
        if (t <= 0.27) opacity = 1;
        else if (t >= 0.5) opacity = 0;
        else opacity = 1 - (t - 0.27) / (0.5 - 0.27);
        introVisibleUse.style.opacity = opacity;

        // 3) Dokončení revealu = MĚKKÁ dilatace TÉHOŽ #introMaskUse přes
        //    filtr #introFeather (feMorphology + feGaussianBlur složené
        //    na bílé pozadí — viz komentář v index.html), ne tvrdý
        //    stroke a ne nový tvar. Start kolem t≈0,66 (poslední
        //    třetina), M&M je v tu chvíli už velmi velké.
        //
        //    Stejný princip jako dřív u stroke: nejdřív spočítáme
        //    požadovaný dosah PŘÍMO V OBRAZOVKOVÝCH PIXELECH
        //    (desiredScreenDilate) po hladké smoothstep křivce, pak
        //    ho převedeme na lokální jednotky filtru vydělením
        //    aktuálním scale — tím se ruší multiplikativní efekt
        //    transformace (dilate radius i blur stdDeviation se totiž
        //    animací #introMaskUse škálují úplně stejně jako dřív
        //    stroke-width).
        //
        //    Blur (feather) je záměrně jen zlomek dilatace (~18 %) —
        //    "velmi jemný", jak žádáno: jeho úkolem je jen rozetřít
        //    ostrou hranu do skutečného BAREVNÉHO přechodu (černá →
        //    šedá → bílá), aby luminance maska četla plynulý přechod
        //    místo tvrdého skoku — ne vytvořit viditelně mlhavý efekt.
        const DILATE_START = 0.66;
        const u = Math.max(0, Math.min(1, (t - DILATE_START) / (1 - DILATE_START)));
        const smooth = u * u * (3 - 2 * u); // smoothstep — plynulý start i konec
        const desiredScreenDilate = smooth * MAX_SCREEN_DILATE;
        const desiredScreenBlur = desiredScreenDilate * 0.18;

        introDilate.setAttribute("radius", Math.max(0, desiredScreenDilate / scale));
        introBlur.setAttribute("stdDeviation", Math.max(0, desiredScreenBlur / scale));

        if (t < 1) {
          requestAnimationFrame(krok);
        } else {
          // t=1 → desiredScreenDilate je přesně MAX_SCREEN_DILATE,
          // matematicky zaručeně dost na pokrytí celého panelu (viz
          // výpočet výše) — a protože se řídí v obrazovkových pixelech,
          // poslední snímky k tomu doputují plynule, ne skokem.
          // Než #intro smažeme, počkáme na DVA požadavky
          // requestAnimationFrame — to je standardní záruka, že
          // prohlížeč tento snímek se stoprocentním pokrytím skutečně
          // vykreslil. Teprve pak je odstranění vizuálně neznatelné.
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

    if (document.fonts && document.fonts.ready) {
      Promise.race([
        document.fonts.ready,
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
      // České skloňování: 1 den, 2–4 dny, 5+ dní
      const tvar = dni === 1 ? "den" : dni >= 2 && dni <= 4 ? "dny" : "dní";
      odpocet.textContent = dni === 0 ? "je to dnes! · " : `za ${dni} ${tvar} · `;
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
  // 3. Jemný parallax velkých fotografií (předěl, finále)
  //    Fotka je zvětšená na 110 % a posouvá se o ±4 % výšky.
  // ------------------------------------------------------------
  if (!bezPohybu) {
    const fotky = document.querySelectorAll(".hero-photo img, .predel img, .finale-photo");
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
