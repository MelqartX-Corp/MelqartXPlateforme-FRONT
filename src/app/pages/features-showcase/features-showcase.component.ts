import { Component, HostListener, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService, AuthService } from '../../services';

type Lang = 'fr' | 'en';

interface LandingContent {
  nav: { home: string; about: string; expertise: string; manufacturing: string; industries: string; products: string; resources: string; faq: string; contact: string };
  space: string;
  signin: string;
  signup: string;
  hero: { badge: string; title: string; subhead: string; subtitle: string; cta1: string; cta2: string; ctaExplore: string; ctaSpace: string };
  overview: { kicker: string; title: string; body: string };
  cap: { kicker: string; title: string; items: { iconId: string; title: string; desc: string }[] };
  why: { kicker: string; title: string; body: string };
  proc: { kicker: string; title: string; steps: string[] };
  prod: { kicker: string; title: string; body: string };
  ind: { kicker: string; title: string; list: string };
  navi: { kicker: string; title: string; body: string };
  res: { kicker: string; title: string; body: string; catTitle: string; cats: string[]; featTitle: string; articles: string[]; soon: string };
  faq: { kicker: string; title: string; items: { q: string; a: string }[] };
  contact: {
    kicker: string; title: string; subtitle: string;
    infoTitle: string; commit: string;
    labels: { email: string; phone: string; address: string };
    cta: string; quote: string;
  };
  final: { title: string; body: string };
  footer: { tagline: string; links: string; legal: string; space: string; rights: string };
}

const CONTENT: Record<Lang, LandingContent> = {
  fr: {
    nav: {
      home: 'Accueil',
      about: 'Qui sommes-nous',
      expertise: 'Expertise',
      manufacturing: 'Fabrication',
      industries: 'Industries',
      products: 'Produits',
      resources: 'Ressources',
      faq: 'FAQ',
      contact: 'Contact',
    },
    space: 'Mon espace',
    signin: 'Se connecter',
    signup: 'S\'inscrire',
    hero: {
      badge: 'Ingénierie & fabrication électronique',
      title: 'Fabrication Électronique Rapide et Fiable',
      subhead: 'Du Prototypage à la Production de Masse',
      subtitle: 'MelqartX propose des solutions complètes de développement et de fabrication électronique, associant expertise d\'ingénierie, prototypage rapide et production industrielle évolutive. De la conception électronique et des systèmes embarqués jusqu\'à la conception mécanique et la fabrication, nous accompagnons les innovateurs dans la transformation de leurs idées en produits fiables.',
      cta1: 'Demander un devis',
      cta2: 'Démarrer votre projet',
      ctaExplore: 'Découvrir nos expertises',
      ctaSpace: 'Accéder à mon espace',
    },
    overview: {
      kicker: 'L\'entreprise',
      title: 'Une expertise intégrée, de l\'idée à la production.',
      body: 'MelqartX est une société d\'ingénierie et de fabrication électronique dédiée à l\'accélération du développement produit grâce à la rapidité, la précision et la fiabilité industrielle. Nous réunissons la conception électronique, les systèmes embarqués, le prototypage PCB, la conception mécanique et la fabrication afin d\'accompagner les produits de l\'idée jusqu\'à la production.',
    },
    cap: {
      kicker: 'Compétences clés',
      title: 'Une chaîne complète d\'ingénierie et de fabrication.',
      items: [
        { iconId: 'circuit-board', title: 'Conception électronique', desc: 'Concevoir des architectures électroniques fiables, des PCB et des solutions matérielles optimisées.' },
        { iconId: 'cpu', title: 'Développement embarqué', desc: 'Développement firmware et logiciel embarqué pour systèmes connectés et intelligents.' },
        { iconId: 'rocket', title: 'Prototypage rapide', desc: 'Fabrication rapide de prototypes et validation pour réduire les cycles de développement.' },
        { iconId: 'factory', title: 'Fabrication', desc: 'Fabrication industrielle et assemblage évolutif de petites séries à la production de masse.' },
        { iconId: 'box', title: 'Conception mécanique', desc: 'Conception mécanique et design d\'enveloppes via SolidWorks pour une intégration optimale.' },
        { iconId: 'lightbulb', title: 'Conseil en ingénierie', desc: 'Conseil technique et optimisation d\'architecture pour renforcer la réussite des projets.' },
      ],
    },
    why: {
      kicker: 'Pourquoi MelqartX',
      title: 'Excellence d\'ingénierie. Exécution industrielle.',
      body: 'MelqartX associe excellence d\'ingénierie et exécution industrielle. Notre approche intégrée réduit la complexité, accélère le développement et garantit des standards de fabrication fiables.',
    },
    proc: {
      kicker: 'Processus',
      title: 'Du concept à la production de masse.',
      steps: [
        'Idée & cahier des charges',
        'Conception électronique & mécanique',
        'Fabrication de prototypes',
        'Validation & tests',
        'Industrialisation',
        'Production de masse',
      ],
    },
    prod: {
      kicker: 'Production & équipements',
      title: 'Une capacité industrielle moderne.',
      body: 'Notre environnement de production combine expertise d\'ingénierie et capacité industrielle. MelqartX assure l\'assemblage PCB rapide, la production SMT et les procédures de validation grâce à des équipements modernes.',
    },
    ind: {
      kicker: 'Industries',
      title: 'Des secteurs exigeants, des produits fiables.',
      list: 'Automobile · IoT · Flottes & Mobilité · Électronique industrielle · Recherche & Innovation',
    },
    navi: {
      kicker: 'Innovation phare',
      title: 'NaviTrack',
      body: 'NaviTrack reflète le savoir-faire de MelqartX en intégrant électronique, systèmes embarqués et connectivité dans une plateforme intelligente de diagnostic et de suivi.',
    },
    res: {
      kicker: 'Ressources',
      title: 'Articles, analyses et actualités.',
      body: 'La section Ressources MelqartX propose des articles techniques, des analyses industrielles et des actualités innovation afin d\'aider ingénieurs, innovateurs et professionnels à rester informés.',
      catTitle: 'Explorez par thématique.',
      cats: [
        'Ingénierie électronique',
        'Systèmes embarqués',
        'Conception & fabrication PCB',
        'Production industrielle',
        'IoT & systèmes connectés',
        'Innovation & développement produit',
      ],
      featTitle: 'Articles en préparation.',
      articles: [
        'Comment le prototypage rapide accélère le développement électronique',
        'Design for Manufacturing : concevoir une électronique fiable',
        'Choisir la bonne architecture embarquée pour les systèmes connectés',
        'Industrialiser l\'électronique : du prototype à la production',
        'L\'avenir de l\'IoT et de la mobilité connectée',
      ],
      soon: 'Bientôt disponible',
    },
    faq: {
      kicker: 'FAQ',
      title: 'Questions fréquentes',
      items: [
        { q: 'Quels types de projets accompagnez-vous ?', a: 'Nous accompagnons des startups comme des grands groupes sur des plateformes IA, des produits SaaS, des refontes critiques et des architectures cloud à fort impact.' },
        { q: 'Travaillez-vous en régie ou au forfait ?', a: 'Les deux. Nous adaptons le modèle de collaboration à la maturité du produit, à l\'urgence et à vos contraintes budgétaires.' },
        { q: 'Comment garantissez-vous la sécurité des données ?', a: 'Sécurité by design, principes Zero Trust, chiffrement bout-en-bout et revues de code systématiques sur tous nos livrables.' },
        { q: 'Pouvez-vous intégrer l\'IA générative à un produit existant ?', a: 'Oui. Nous concevons des couches IA modulaires qui s\'intègrent à vos systèmes sans réécriture massive.' },
        { q: 'Quels sont vos délais de démarrage ?', a: 'Un premier atelier de cadrage est généralement organisé sous 5 jours ouvrés après le premier contact.' },
      ],
    },
    contact: {
      kicker: 'Contact',
      title: 'Construisons Ensemble des Solutions Fiables',
      subtitle: 'Que vous développiez un prototype, prépariez une production industrielle ou exploriez un nouveau concept électronique, MelqartX est prêt à accompagner votre projet grâce à son expertise d\'ingénierie et ses capacités de fabrication.',
      infoTitle: 'Une communication claire, une collaboration réactive.',
      commit: 'Nous nous engageons à répondre rapidement et à fournir des orientations concrètes pour faire avancer votre projet.',
      labels: { email: 'Email', phone: 'Téléphone', address: 'Adresse' },
      cta: 'Parler à notre équipe',
      quote: 'Demander un devis',
    },
    final: {
      title: 'Prêt à développer votre prochain produit électronique ?',
      body: 'MelqartX vous accompagne pour transformer votre concept en une solution industrielle fiable.',
    },
    footer: {
      tagline: 'MelqartX associe expertise d\'ingénierie et capacité industrielle afin d\'aider les innovateurs à développer des produits électroniques fiables.',
      links: 'Navigation',
      legal: 'Légal',
      space: 'Espace client',
      rights: 'Tous droits réservés.',
    },
  },
  en: {
    nav: {
      home: 'Home',
      about: 'About',
      expertise: 'Expertise',
      manufacturing: 'Manufacturing',
      industries: 'Industries',
      products: 'Products',
      resources: 'Resources',
      faq: 'FAQ',
      contact: 'Contact',
    },
    space: 'My space',
    signin: 'Sign in',
    signup: 'Sign up',
    hero: {
      badge: 'Electronics engineering & manufacturing',
      title: 'Fast & Reliable Electronics Manufacturing',
      subhead: 'From Prototype to Mass Production',
      subtitle: 'MelqartX delivers end-to-end electronic product development and manufacturing solutions, combining engineering expertise, rapid prototyping and scalable production. From electronic design and embedded systems to mechanical engineering and industrial manufacturing, we help innovators transform ideas into reliable products.',
      cta1: 'Request a quote',
      cta2: 'Start your project',
      ctaExplore: 'Explore our expertise',
      ctaSpace: 'Go to my space',
    },
    overview: {
      kicker: 'Company',
      title: 'Integrated expertise, from idea to production.',
      body: 'MelqartX is an engineering and electronics manufacturing company dedicated to accelerating product development with speed, precision and industrial reliability. We provide integrated expertise across electronic design, embedded systems, PCB prototyping, mechanical engineering and manufacturing to support products from concept to production.',
    },
    cap: {
      kicker: 'Core capabilities',
      title: 'A full engineering & manufacturing chain.',
      items: [
        { iconId: 'circuit-board', title: 'Electronic design', desc: 'Designing reliable electronic architectures, PCB layouts and optimized hardware solutions for modern products.' },
        { iconId: 'cpu', title: 'Embedded development', desc: 'Firmware and embedded software development for connected and intelligent systems.' },
        { iconId: 'rocket', title: 'Rapid prototyping', desc: 'Fast prototype manufacturing and validation to reduce development cycles.' },
        { iconId: 'factory', title: 'Manufacturing', desc: 'Industrial manufacturing and scalable assembly from small series to mass production.' },
        { iconId: 'box', title: 'Mechanical design', desc: 'Mechanical engineering and enclosure design using SolidWorks for seamless integration.' },
        { iconId: 'lightbulb', title: 'Engineering consulting', desc: 'Technical consulting and architecture optimization to strengthen project success.' },
      ],
    },
    why: {
      kicker: 'Why MelqartX',
      title: 'Engineering excellence. Industrial execution.',
      body: 'MelqartX combines engineering excellence with industrial execution. Our integrated workflow reduces complexity, shortens development time and ensures reliable manufacturing standards.',
    },
    proc: {
      kicker: 'Process',
      title: 'From concept to mass production.',
      steps: [
        'Idea & requirements',
        'Electronic & mechanical design',
        'Prototype manufacturing',
        'Validation & testing',
        'Industrialization',
        'Mass production',
      ],
    },
    prod: {
      kicker: 'Production & facilities',
      title: 'Modern industrial capability.',
      body: 'Our production environment combines engineering expertise and manufacturing capability. MelqartX supports rapid PCB assembly, SMT production and validation workflows using modern industrial equipment.',
    },
    ind: {
      kicker: 'Industries we serve',
      title: 'Demanding sectors, reliable products.',
      list: 'Automotive · IoT · Fleet & Mobility · Industrial Electronics · Research & Innovation',
    },
    navi: {
      kicker: 'Featured innovation',
      title: 'NaviTrack',
      body: 'NaviTrack reflects MelqartX engineering capability, integrating electronics, embedded systems and connectivity into a connected diagnostic and tracking platform.',
    },
    res: {
      kicker: 'Resources',
      title: 'Articles, insights and updates.',
      body: 'The MelqartX Resources section provides technical articles, manufacturing insights and innovation updates helping engineers, innovators and industry professionals stay informed.',
      catTitle: 'Browse by topic.',
      cats: [
        'Electronics Engineering',
        'Embedded Systems',
        'PCB Design & Manufacturing',
        'Industrial Production',
        'IoT & Connected Systems',
        'Innovation & Product Development',
      ],
      featTitle: 'Articles coming soon.',
      articles: [
        'How Rapid Prototyping Accelerates Electronic Product Development',
        'Design for Manufacturing: Building Reliable Electronics',
        'Choosing the Right Embedded Architecture for Connected Devices',
        'Industrializing Electronics: From Prototype to Production',
        'The Future of IoT and Connected Mobility',
      ],
      soon: 'Coming soon',
    },
    faq: {
      kicker: 'FAQ',
      title: 'Frequently asked questions',
      items: [
        { q: 'What kind of projects do you take on?', a: 'We support startups and large enterprises on AI platforms, SaaS products, critical rebuilds and high-impact cloud architectures.' },
        { q: 'Do you work on a time & materials or fixed-price basis?', a: 'Both. We tailor the collaboration model to product maturity, urgency, and budget constraints.' },
        { q: 'How do you ensure data security?', a: 'Security by design, Zero Trust principles, end-to-end encryption and systematic code reviews on every deliverable.' },
        { q: 'Can you integrate generative AI into an existing product?', a: 'Yes. We design modular AI layers that plug into your systems without a full rewrite.' },
        { q: 'What are your typical lead times?', a: 'An initial scoping workshop usually takes place within 5 business days of first contact.' },
      ],
    },
    contact: {
      kicker: 'Contact',
      title: 'Let\'s Build Something Reliable Together',
      subtitle: 'Whether you are developing a prototype, preparing industrial production or exploring a new electronic concept, MelqartX is ready to support your project with engineering expertise and manufacturing capability.',
      infoTitle: 'Clear communication, responsive collaboration.',
      commit: 'We aim to respond promptly and provide practical guidance to move your project forward.',
      labels: { email: 'Email', phone: 'Phone', address: 'Address' },
      cta: 'Talk to our team',
      quote: 'Request a quote',
    },
    final: {
      title: 'Ready to build your next electronic product?',
      body: 'Let MelqartX help transform your concept into a reliable industrial solution.',
    },
    footer: {
      tagline: 'MelqartX combines engineering expertise and manufacturing capability to help innovators develop reliable electronic products.',
      links: 'Navigation',
      legal: 'Legal',
      space: 'Client area',
      rights: 'All rights reserved.',
    },
  },
};

@Component({
  selector: 'app-features-showcase',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './features-showcase.component.html',
  styleUrl: './features-showcase.component.css'
})
export class FeaturesShowcaseComponent {
  theme = inject(ThemeService);
  auth  = inject(AuthService);

  /** Nav flottante : ombre au scroll, menu déroulant en mobile */
  scrolled = false;
  menuOpen = false;

  lang: Lang = 'fr';

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled = window.scrollY > 12;
  }

  get c(): LandingContent {
    return CONTENT[this.lang];
  }

  toggleLang(): void {
    this.lang = this.lang === 'fr' ? 'en' : 'fr';
  }

  /** Coordonnées affichées dans la section Contact */
  contactInfo = {
    email: 'contact@melqartx.com',
    phone: '+33 1 00 00 00 00',
    address: 'Paris · Tunis · Remote',
  };

  /** Question ouverte dans l'accordéon FAQ (-1 = toutes fermées) */
  openFaq = 0;

  toggleFaq(i: number): void {
    this.openFaq = this.openFaq === i ? -1 : i;
  }

  /**
   * Liens du menu — un lien = une section réelle de la page, dans le même
   * ordre que le site vitrine (Accueil … Contact).
   */
  get navLinks() {
    const nav = this.c.nav;
    return [
      { id: 'top',          label: nav.home },
      { id: 'overview',     label: nav.about },
      { id: 'capabilities', label: nav.expertise },
      { id: 'production',   label: nav.manufacturing },
      { id: 'industries',   label: nav.industries },
      { id: 'navitrack',    label: nav.products },
      { id: 'resources',    label: nav.resources },
      { id: 'faq',          label: nav.faq },
      { id: 'contact',      label: nav.contact },
    ];
  }

  scrollTo(id: string): void {
    this.menuOpen = false;
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  year = new Date().getFullYear();
}
