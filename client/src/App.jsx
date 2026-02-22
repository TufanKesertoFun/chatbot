import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import ChatWidget from './ChatWidget';
import AgentPanel from './AgentPanel';
import {
  Anchor,
  Waves,
  Utensils,
  BedDouble,
  Sparkles,
  MapPin,
  ArrowRight,
  CalendarDays,
  MoonStar,
  Trees,
  MapPinned,
  Building2,
  HeartPulse,
  ShieldCheck,
  Clock3,
} from 'lucide-react';

function ResortLanding() {
  const highlights = [
    { icon: Waves, title: 'Haliç Kıyısı Konumu', text: 'Tarihi yarımadaya ve şehrin kalbine yakın, su kenarında konaklama deneyimi.' },
    { icon: BedDouble, title: 'Zarif Oda Seçenekleri', text: 'Boğaz ve şehir silueti manzaralı, modern ve konfor odaklı tasarım.' },
    { icon: Utensils, title: 'Gastronomi Deneyimi', text: 'Dünya mutfaklarından seçkin menüler ve şef imzalı akşam servisleri.' },
    { icon: Sparkles, title: 'Wellness & Spa', text: 'Hamam, spa ritüelleri ve kişiselleştirilmiş bakım paketleri.' },
  ];

  const experiences = [
    {
      title: 'Sunset Terrace Dining',
      detail: 'Gün batımı eşliğinde gurme akşam yemeği.',
      image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=1600&auto=format&fit=crop',
    },
    {
      title: 'Private Bosphorus Tour',
      detail: 'Özel tekne ile İstanbul siluet turu.',
      image: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=1600&auto=format&fit=crop',
    },
    {
      title: 'Historic Peninsula Discovery',
      detail: 'Rehberli kültür rotası ve özel transfer.',
      image: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?q=80&w=1600&auto=format&fit=crop',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8f5ee] text-[#172338] selection:bg-[#d3b26a] selection:text-[#172338]">
      <nav className="fixed top-0 z-50 w-full border-b border-[#b79b5e]/30 bg-[#0f1a2e]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 text-[#efe4c9]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c7a85f]/70 bg-[#c7a85f]/20">
              <Anchor size={18} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-[#c7a85f]">Luxury Escape</div>
              <div className="font-serif text-xl">Rixos Tersane Istanbul</div>
            </div>
          </div>

          <div className="hidden items-center gap-8 text-sm font-medium text-[#efe4c9]/90 md:flex">
            <a href="#rooms" className="transition hover:text-[#d6bc7d]">Odalar</a>
            <a href="#dining" className="transition hover:text-[#d6bc7d]">Restoranlar</a>
            <a href="#experiences" className="transition hover:text-[#d6bc7d]">Deneyimler</a>
            <Link to="/agent" className="rounded-full border border-[#c7a85f]/60 px-4 py-2 text-[#d6bc7d] transition hover:bg-[#c7a85f]/10">
              Agent Panel
            </Link>
          </div>
        </div>
      </nav>

      <header className="relative flex min-h-screen items-end overflow-hidden pt-24">
        <img
          src="https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2200&auto=format&fit=crop"
          alt="Luxury Hotel"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d1729]/92 via-[#0f1a2e]/70 to-[#0f1a2e]/35" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(215,182,109,0.22),transparent_38%)]" />

        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-6 pb-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6 text-[#f5eddb]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d3b26a]/50 bg-[#d3b26a]/10 px-4 py-1 text-xs uppercase tracking-[0.18em] text-[#e7d3a1]">
              <MoonStar size={14} /> Yeni Sezon Ayrıcalıkları
            </div>
            <h1 className="max-w-3xl text-5xl leading-tight md:text-7xl">
              İstanbul’da
              <span className="block text-[#d9ba73]">Lüks Konaklama</span>
              deneyimini yeniden keşfedin.
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-[#e6dcc5] md:text-lg">
              Tarihi tersane dokusuyla modern resort konforunu bir araya getiren özel bir şehir kaçamağı.
              Odadan restorana, spa’dan kişisel concierge hizmetine kadar tüm deneyim tek noktada.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="#rooms"
                className="inline-flex items-center gap-2 rounded-full bg-[#c8a963] px-6 py-3 text-sm font-semibold text-[#172338] transition hover:bg-[#d8bb7a]"
              >
                Oda Seçenekleri <ArrowRight size={16} />
              </a>
              <a
                href="#experiences"
                className="inline-flex items-center gap-2 rounded-full border border-[#d6bc7d]/60 px-6 py-3 text-sm font-semibold text-[#f1e7d1] transition hover:bg-[#d6bc7d]/10"
              >
                Deneyimleri Keşfet
              </a>
            </div>
          </div>

          <div className="self-end rounded-3xl border border-[#d7be85]/35 bg-[#13203a]/80 p-6 text-[#efe4c9] shadow-2xl backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl">Hızlı Rezervasyon</h2>
              <CalendarDays className="text-[#d7be85]" size={20} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-[#d7be85]/30 bg-[#0f1a2e]/70 p-3">
                <div className="text-xs uppercase text-[#c7a85f]">Giriş</div>
                <div className="mt-1 font-semibold">15 Mart 2026</div>
              </div>
              <div className="rounded-xl border border-[#d7be85]/30 bg-[#0f1a2e]/70 p-3">
                <div className="text-xs uppercase text-[#c7a85f]">Çıkış</div>
                <div className="mt-1 font-semibold">18 Mart 2026</div>
              </div>
              <div className="rounded-xl border border-[#d7be85]/30 bg-[#0f1a2e]/70 p-3">
                <div className="text-xs uppercase text-[#c7a85f]">Konuk</div>
                <div className="mt-1 font-semibold">2 Yetişkin</div>
              </div>
              <div className="rounded-xl border border-[#d7be85]/30 bg-[#0f1a2e]/70 p-3">
                <div className="text-xs uppercase text-[#c7a85f]">Oda</div>
                <div className="mt-1 font-semibold">Deluxe Suite</div>
              </div>
            </div>
            <button className="mt-4 w-full rounded-xl bg-[#c8a963] py-3 text-sm font-semibold text-[#172338] transition hover:bg-[#d8bb7a]">
              Uygunluk Gör
            </button>
          </div>
        </div>
      </header>

      <section className="border-y border-[#d9c7a0]/40 bg-[#f1e7d4] py-14">
        <div className="mx-auto grid max-w-7xl gap-5 px-6 md:grid-cols-2 lg:grid-cols-4">
          {highlights.map((item) => (
            <div key={item.title} className="rounded-2xl border border-[#d8c39b] bg-white/80 p-5 shadow-sm">
              <item.icon size={18} className="text-[#bb9956]" />
              <h3 className="mt-3 text-lg text-[#172338]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#41506b]">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="rooms" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#ab8a4d]">Rooms & Suites</div>
            <h2 className="mt-2 text-4xl text-[#172338]">Manzara odaklı konaklama seçenekleri</h2>
          </div>
          <div className="hidden items-center gap-2 text-sm text-[#4c5c79] md:flex">
            <MapPin size={15} /> Beyoğlu, İstanbul
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'Deluxe Golden Horn View',
              price: '€420 / gece',
              image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1400&auto=format&fit=crop',
            },
            {
              title: 'Bosphorus Signature Suite',
              price: '€690 / gece',
              image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=1400&auto=format&fit=crop',
            },
            {
              title: 'Family Terrace Residence',
              price: '€840 / gece',
              image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1400&auto=format&fit=crop',
            },
          ].map((room) => (
            <article key={room.title} className="group overflow-hidden rounded-2xl border border-[#e3d2ae] bg-white shadow-sm">
              <div className="relative h-56 overflow-hidden">
                <img src={room.image} alt={room.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#101a2f]/65 to-transparent" />
                <div className="absolute bottom-3 left-3 rounded-full bg-[#c8a963] px-3 py-1 text-xs font-semibold text-[#172338]">Premium</div>
              </div>
              <div className="p-5">
                <h3 className="text-xl text-[#172338]">{room.title}</h3>
                <p className="mt-2 text-sm text-[#50607b]">Geniş yaşam alanı, özel banyo deneyimi ve kişisel concierge hizmeti.</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-semibold text-[#b08e4e]">{room.price}</span>
                  <button className="rounded-full border border-[#c8a963]/70 px-3 py-1 text-xs font-semibold text-[#a17f42] transition hover:bg-[#c8a963]/10">
                    Detay
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="dining" className="bg-[#12203a] py-20 text-[#efe4c9]">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#d4b572]">Dining</div>
            <h2 className="mt-2 text-4xl">Şef imzalı restoran ve teras deneyimi</h2>
            <p className="mt-5 text-sm leading-relaxed text-[#d8cdb3]">
              Akdeniz mutfağından çağdaş dünya lezzetlerine uzanan geniş menü, canlı müzik eşliğinde unutulmaz bir akşam
              deneyimi sunar.
            </p>
            <button className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#c8a963] px-6 py-3 text-sm font-semibold text-[#172338] transition hover:bg-[#d8bb7a]">
              Restoranları İncele <ArrowRight size={15} />
            </button>
          </div>
          <img
            src="https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1600&auto=format&fit=crop"
            alt="Dining"
            className="h-[360px] w-full rounded-3xl object-cover"
          />
        </div>
      </section>

      <section id="experiences" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.2em] text-[#ab8a4d]">Experiences</div>
          <h2 className="mt-2 text-4xl text-[#172338]">Rixos Tersane İstanbul ilhamlı seçili aktiviteler</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {experiences.map((exp) => (
            <article key={exp.title} className="overflow-hidden rounded-2xl border border-[#e4d4b3] bg-white shadow-sm">
              <img src={exp.image} alt={exp.title} className="h-48 w-full object-cover" />
              <div className="p-5">
                <h3 className="text-xl text-[#1a2a42]">{exp.title}</h3>
                <p className="mt-2 text-sm text-[#52637f]">{exp.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#d7c39b] bg-[#f1e7d4] py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-6 text-sm text-[#435571] md:flex-row md:items-center">
          <div>
            <div className="font-semibold text-[#16243b]">Rixos Tersane Istanbul - Demo Landing</div>
            <div>© 2026 OvoBot Tourism Demo</div>
          </div>
          <div className="text-xs uppercase tracking-[0.16em] text-[#8d7343]">
            PoC by OvoWidget SDK
          </div>
        </div>
      </footer>

      <ChatWidget
        brandName="Rixos Tersane Istanbul"
        locale="tr"
        i18n={{
          tr: {
            header: { title: '{brand} Concierge' },
            greeting: { text: '{brand} asistanina hos geldiniz. Rezervasyon, oda, restoran ve etkinlikler icin yardimci olabilirim.' },
          },
        }}
      />
    </div>
  );
}

function LandSalesLanding() {
  const projects = [
    { name: 'Doğa Vadi Parselleri', m2: '450 - 900 m2', location: 'Silivri', price: '₺1.290.000+' },
    { name: 'Marmara Panorama Etabı', m2: '350 - 700 m2', location: 'Çatalca', price: '₺1.050.000+' },
    { name: 'Yatırım Bahçe Ev Alanı', m2: '500 - 1.100 m2', location: 'Tekirdağ', price: '₺980.000+' },
  ];

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#223021] selection:bg-[#9fb77b]">
      <nav className="fixed top-0 z-50 w-full border-b border-[#8ca66a]/30 bg-[#1f2d1f]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 text-[#e9efd9]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#9fb77b]/70 bg-[#9fb77b]/20">
              <Trees size={18} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-[#b7ca95]">Arsa & Yatırım</div>
              <div className="font-serif text-xl">ArsaVev Demo</div>
            </div>
          </div>
          <div className="hidden items-center gap-8 text-sm font-medium text-[#e7ecd8] md:flex">
            <a href="#projects" className="transition hover:text-[#c9d9ad]">Projeler</a>
            <a href="#advantages" className="transition hover:text-[#c9d9ad]">Avantajlar</a>
            <a href="#investment" className="transition hover:text-[#c9d9ad]">Yatırım Modeli</a>
            <Link to="/agent" className="rounded-full border border-[#9fb77b]/60 px-4 py-2 text-[#d7e5be] transition hover:bg-[#9fb77b]/10">
              Agent Panel
            </Link>
          </div>
        </div>
      </nav>

      <header className="relative flex min-h-[88vh] items-end overflow-hidden pt-24">
        <img
          src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2200&auto=format&fit=crop"
          alt="Land investment"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#202f21]/90 via-[#243824]/70 to-[#243824]/30" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-6 pb-20 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6 text-[#eef2e4]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#b7ca95]/50 bg-[#b7ca95]/10 px-4 py-1 text-xs uppercase tracking-[0.18em] text-[#dce8c9]">
              <MapPinned size={14} /> Tapulu Arsa Fırsatları
            </div>
            <h1 className="max-w-3xl text-5xl leading-tight md:text-7xl">
              Geleceğe Değer Katan
              <span className="block text-[#c8dba8]">Arsa Yatırımı</span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-[#e2e9d3] md:text-lg">
              Ulaşım akslarına yakın, planlı gelişim bölgelerinde yatırım potansiyeli yüksek arsa seçenekleri.
              Parsel özellikleri, imar durumu ve ödeme modeli için anında bilgi alın.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#projects" className="inline-flex items-center gap-2 rounded-full bg-[#afc887] px-6 py-3 text-sm font-semibold text-[#1f2d1f] transition hover:bg-[#bfd99b]">
                Projeleri İncele <ArrowRight size={16} />
              </a>
              <a href="#investment" className="inline-flex items-center gap-2 rounded-full border border-[#c8dba8]/60 px-6 py-3 text-sm font-semibold text-[#edf3df] transition hover:bg-[#c8dba8]/10">
                Ödeme Seçenekleri
              </a>
            </div>
          </div>
          <div className="self-end rounded-3xl border border-[#b2c692]/35 bg-[#243824]/85 p-6 text-[#e7edd9] shadow-2xl backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl">Hızlı Ön Bilgilendirme</h2>
              <Building2 className="text-[#b7ca95]" size={20} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-[#b7ca95]/30 bg-[#1f2d1f]/70 p-3">
                <div className="text-xs uppercase text-[#b7ca95]">Bölge</div>
                <div className="mt-1 font-semibold">Silivri / Çatalca</div>
              </div>
              <div className="rounded-xl border border-[#b7ca95]/30 bg-[#1f2d1f]/70 p-3">
                <div className="text-xs uppercase text-[#b7ca95]">Parsel Tipi</div>
                <div className="mt-1 font-semibold">Müstakil Tapu</div>
              </div>
              <div className="rounded-xl border border-[#b7ca95]/30 bg-[#1f2d1f]/70 p-3">
                <div className="text-xs uppercase text-[#b7ca95]">Vade</div>
                <div className="mt-1 font-semibold">24 Aya Kadar</div>
              </div>
              <div className="rounded-xl border border-[#b7ca95]/30 bg-[#1f2d1f]/70 p-3">
                <div className="text-xs uppercase text-[#b7ca95]">Teslim</div>
                <div className="mt-1 font-semibold">Hemen Devir</div>
              </div>
            </div>
            <button className="mt-4 w-full rounded-xl bg-[#afc887] py-3 text-sm font-semibold text-[#1f2d1f] transition hover:bg-[#bfd99b]">
              Uygun Parselleri Gör
            </button>
          </div>
        </div>
      </header>

      <section id="projects" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.2em] text-[#7a9457]">Projeler</div>
          <h2 className="mt-2 text-4xl text-[#233321]">Bölge bazlı seçili arsa portföyü</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {projects.map((item) => (
            <article key={item.name} className="overflow-hidden rounded-2xl border border-[#d8dfcc] bg-white shadow-sm">
              <div className="h-48 bg-[linear-gradient(135deg,#c8dba8,#9fb77b)]" />
              <div className="p-5">
                <h3 className="text-xl text-[#233321]">{item.name}</h3>
                <div className="mt-2 text-sm text-[#4e6243]">{item.location} · {item.m2}</div>
                <div className="mt-3 font-semibold text-[#5a7546]">{item.price}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="advantages" className="border-y border-[#dbe3cf] bg-[#eef2e4] py-16">
        <div className="mx-auto grid max-w-7xl gap-5 px-6 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: 'Şeffaf Süreç', text: 'Tapu, imar ve teknik dökümanlara tek panelden erişim.' },
            { icon: MapPinned, title: 'Lokasyon Analizi', text: 'Yol, ulaşım ve gelişim planlarına göre karşılaştırmalı analiz.' },
            { icon: Clock3, title: 'Hızlı Yanıt', text: 'Canlı danışman + bot destekli anlık soru/cevap akışı.' },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-[#d5deca] bg-white p-5 shadow-sm">
              <item.icon size={18} className="text-[#6f8c52]" />
              <h3 className="mt-3 text-lg text-[#233321]">{item.title}</h3>
              <p className="mt-2 text-sm text-[#526548]">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="investment" className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-4xl text-[#233321]">Yatırım Planı</h2>
        <p className="mt-4 max-w-3xl text-[#4f6245]">
          Peşin alım, ara ödeme ve taksitli model seçeneklerini karşılaştırabilir, size en uygun finansman planını hızlıca oluşturabilirsiniz.
        </p>
      </section>

      <ChatWidget
        brandName="ArsaVev"
        locale="tr"
        i18n={{
          tr: {
            header: { title: '{brand} Arsa Danışmanı' },
            greeting: { text: '{brand} platformuna hoş geldiniz. Parsel, imar durumu ve ödeme seçenekleri hakkında yardımcı olabilirim.' },
          },
        }}
      />
    </div>
  );
}

function HospitalLanding() {
  const departments = [
    { name: 'Kardiyoloji', text: 'Kalp ve damar hastalıklarında tanı, takip ve tedavi.' },
    { name: 'Ortopedi', text: 'Kas-iskelet sistemi için uzman değerlendirme ve tedavi planı.' },
    { name: 'Check-up Merkezi', text: 'Kişiye özel paketlerle önleyici sağlık yaklaşımı.' },
  ];

  return (
    <div className="min-h-screen bg-[#f5f8fb] text-[#17324d] selection:bg-[#95c6ea]">
      <nav className="fixed top-0 z-50 w-full border-b border-[#95c6ea]/35 bg-[#0f3353]/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 text-[#e7f3fd]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#95c6ea]/70 bg-[#95c6ea]/20">
              <HeartPulse size={18} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-[#a9d3f2]">Sağlık Hizmeti</div>
              <div className="font-serif text-xl">OvoCare Hospital Demo</div>
            </div>
          </div>
          <div className="hidden items-center gap-8 text-sm font-medium text-[#e3f1fb] md:flex">
            <a href="#departments" className="transition hover:text-[#bde0f8]">Branşlar</a>
            <a href="#services" className="transition hover:text-[#bde0f8]">Hizmetler</a>
            <a href="#contact" className="transition hover:text-[#bde0f8]">İletişim</a>
            <Link to="/agent" className="rounded-full border border-[#95c6ea]/60 px-4 py-2 text-[#cde8fa] transition hover:bg-[#95c6ea]/10">
              Agent Panel
            </Link>
          </div>
        </div>
      </nav>

      <header className="relative flex min-h-[82vh] items-end overflow-hidden pt-24">
        <img
          src="https://images.unsplash.com/photo-1586773860418-d37222d8fce3?q=80&w=2200&auto=format&fit=crop"
          alt="Hospital"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#113b5b]/92 via-[#0f3353]/75 to-[#0f3353]/35" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-6 pb-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6 text-[#e8f4fc]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#95c6ea]/50 bg-[#95c6ea]/10 px-4 py-1 text-xs uppercase tracking-[0.18em] text-[#cde8fa]">
              <ShieldCheck size={14} /> Güvenilir Sağlık Danışmanı
            </div>
            <h1 className="max-w-3xl text-5xl leading-tight md:text-7xl">
              Hızlı Randevu,
              <span className="block text-[#a8d4f2]">Doğru Yönlendirme</span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-[#d8ebf8] md:text-lg">
              Branş seçimi, doktor uygunluğu, hazırlık adımları ve randevu süreçleri için tek noktadan bilgilendirme.
              Chatbot ile ön bilgi, canlı temsilci ile hızlı destek.
            </p>
            <a href="#departments" className="inline-flex items-center gap-2 rounded-full bg-[#95c6ea] px-6 py-3 text-sm font-semibold text-[#113b5b] transition hover:bg-[#a7d3f1]">
              Branşları Gör <ArrowRight size={16} />
            </a>
          </div>
          <div className="self-end rounded-3xl border border-[#95c6ea]/35 bg-[#0f3353]/86 p-6 text-[#eaf5fd] shadow-2xl backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl">Hızlı Randevu Asistanı</h2>
              <CalendarDays className="text-[#95c6ea]" size={20} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-[#95c6ea]/30 bg-[#0d2e4b]/80 p-3">
                <div className="text-xs uppercase text-[#95c6ea]">Branş</div>
                <div className="mt-1 font-semibold">Kardiyoloji</div>
              </div>
              <div className="rounded-xl border border-[#95c6ea]/30 bg-[#0d2e4b]/80 p-3">
                <div className="text-xs uppercase text-[#95c6ea]">Doktor</div>
                <div className="mt-1 font-semibold">Uygunluk Sorgu</div>
              </div>
              <div className="rounded-xl border border-[#95c6ea]/30 bg-[#0d2e4b]/80 p-3">
                <div className="text-xs uppercase text-[#95c6ea]">Muayene Tipi</div>
                <div className="mt-1 font-semibold">İlk Değerlendirme</div>
              </div>
              <div className="rounded-xl border border-[#95c6ea]/30 bg-[#0d2e4b]/80 p-3">
                <div className="text-xs uppercase text-[#95c6ea]">Süreç</div>
                <div className="mt-1 font-semibold">Online Ön Kayıt</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section id="departments" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.2em] text-[#4f8ab4]">Bölümler</div>
          <h2 className="mt-2 text-4xl text-[#17324d]">Uzmanlık alanlarımız</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {departments.map((dept) => (
            <article key={dept.name} className="rounded-2xl border border-[#d1e5f5] bg-white p-5 shadow-sm">
              <h3 className="text-xl text-[#17324d]">{dept.name}</h3>
              <p className="mt-2 text-sm text-[#446581]">{dept.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="services" className="border-y border-[#d3e7f5] bg-[#eaf4fb] py-16">
        <div className="mx-auto grid max-w-7xl gap-5 px-6 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: 'Hasta Güvenliği', text: 'Klinik protokollere uygun, güvenli hizmet süreci.' },
            { icon: Clock3, title: 'Hızlı Randevu', text: 'Uygun doktor ve saat için kısa sürede yönlendirme.' },
            { icon: HeartPulse, title: 'Kişiye Özel Takip', text: 'Tedavi sonrası kontrol ve bilgilendirme akışı.' },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-[#d4e8f6] bg-white p-5 shadow-sm">
              <item.icon size={18} className="text-[#3c79a6]" />
              <h3 className="mt-3 text-lg text-[#17324d]">{item.title}</h3>
              <p className="mt-2 text-sm text-[#486b87]">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-4xl text-[#17324d]">İletişim ve Randevu</h2>
        <p className="mt-4 max-w-3xl text-[#476983]">
          Chatbot üzerinden branş ve randevu süreci hakkında bilgi alabilir, talebinizin uygun olduğu noktada canlı destek ekibine bağlanabilirsiniz.
        </p>
      </section>

      <ChatWidget
        brandName="OvoCare Hospital"
        locale="tr"
        i18n={{
          tr: {
            header: { title: '{brand} Asistanı' },
            greeting: { text: '{brand} platformuna hoş geldiniz. Randevu, branş seçimi ve süreç bilgilendirmesi için yardımcı olabilirim.' },
          },
        }}
      />
    </div>
  );
}

function SectorSwitcher({ selected, onChange }) {
  const options = [
    { key: 'tourism', label: 'Turizm' },
    { key: 'land', label: 'Arsa Satış' },
    { key: 'hospital', label: 'Hastane' },
  ];

  return (
    <div className="fixed left-1/2 top-20 z-[60] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              selected === opt.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectorDemoPage() {
  const [selectedSector, setSelectedSector] = useState('tourism');

  return (
    <>
      <SectorSwitcher selected={selectedSector} onChange={setSelectedSector} />
      {selectedSector === 'tourism' && <ResortLanding />}
      {selectedSector === 'land' && <LandSalesLanding />}
      {selectedSector === 'hospital' && <HospitalLanding />}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SectorDemoPage />} />
        <Route path="/agent" element={<AgentPanel />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
