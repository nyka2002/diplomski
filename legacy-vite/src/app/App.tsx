import { useState, useEffect } from "react";
import {
  Heart, Home, Bookmark, User, LogIn, Moon, Sun, Globe,
  ChevronLeft, ChevronRight, Search, SlidersHorizontal, Send,
  X, ExternalLink, Phone, Mail, Building2, Menu, LogOut,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Page = "home" | "buy" | "rent" | "saved" | "signin" | "register" | "account" | "listing";
type Lang = "en" | "hr";

interface Listing {
  id: string;
  type: "sale" | "rent";
  title: string;
  titleHr: string;
  price: string;
  location: string;
  images: string[];
  description: string;
  descriptionHr: string;
  specs: { label: string; labelHr: string; value: string; valueHr?: string }[];
  seller: { name: string; phone: string; email: string; agency: string };
  originalUrl: string;
}

// ─── Translations ─────────────────────────────────────────────────────────────

const translations = {
  en: {
    nav: { home: "Home", buy: "Buy", rent: "Rent", saved: "Saved Listings", signin: "Sign In", register: "Create Account", account: "Account" },
    hero: { title: "Find Your Perfect Home", subtitle: "Browse thousands of properties for sale and rent across Croatia" },
    forSale: "Properties for Sale",
    forRent: "Properties for Rent",
    viewAll: "View all →",
    saved: {
      empty: "No saved listings – start browsing",
      emptyHint: "Save properties you love to compare them later.",
      buy: "Buy",
      rent: "Rent",
      saleSection: "Properties for Sale",
      rentSection: "Properties for Rent",
    },
    sort: { label: "Sort by", newest: "Newest", priceLow: "Price: Low to High", priceHigh: "Price: High to Low" },
    ai: {
      title: "AI Property Search",
      placeholder: "Describe your ideal property… e.g. \"2 bedroom apartment near the city center with a balcony, under €200,000\"",
      send: "Search",
      hint: "Powered by AI — describe what you are looking for in natural language",
      searching: "Searching…",
    },
    signin: { title: "Welcome Back", username: "Username / Email Address", password: "Password", button: "Sign In", noAccount: "Don't have an account?", create: "Create one" },
    register: { title: "Create Account", firstName: "First Name", lastName: "Last Name", username: "Username", email: "Email Address", phone: "Phone Number", password: "Password", confirm: "Confirm Password", button: "Create Account", hasAccount: "Already have an account?", login: "Sign in" },
    account: { title: "My Account", firstName: "First Name", lastName: "Last Name", username: "Username", email: "Email Address", phone: "Phone Number", edit: "Edit Profile", save: "Save Changes", cancel: "Cancel", currentPw: "Current Password", newPw: "New Password", confirmPw: "Confirm New Password", signout: "Sign Out", changePw: "Change Password" },
    signout: { title: "Sign Out", message: "Are you sure you want to sign out?", yes: "Yes", no: "No" },
    listing: { price: "Price", seller: "Landlord / Seller Information", viewOriginal: "View Original Listing", specs: "Property Details", description: "Description", contact: "Contact Seller", back: "Back to listings", backSaved: "Back to Saved Listings" },
  },
  hr: {
    nav: { home: "Početna", buy: "Kupnja", rent: "Najam", saved: "Spremljeni oglasi", signin: "Prijava", register: "Registracija", account: "Račun" },
    hero: { title: "Pronađite Svoj Savršeni Dom", subtitle: "Pregledajte tisuće nekretnina za kupnju i najam diljem Hrvatske" },
    forSale: "Nekretnine na prodaju",
    forRent: "Nekretnine za najam",
    viewAll: "Prikaži sve →",
    saved: {
      empty: "Nema spremljenih oglasa – počnite pregledavati",
      emptyHint: "Spremite nekretnine koje vam se sviđaju za kasniju usporedbu.",
      buy: "Kupnja",
      rent: "Najam",
      saleSection: "Nekretnine na prodaju",
      rentSection: "Nekretnine za najam",
    },
    sort: { label: "Sortiraj", newest: "Najnoviji", priceLow: "Cijena: Uzlazno", priceHigh: "Cijena: Silazno" },
    ai: {
      title: "AI Pretraga nekretnina",
      placeholder: "Opišite idealnu nekretninu… npr. \"Stan s 2 sobe blizu centra s balkonom, do 200.000 €\"",
      send: "Pretraži",
      hint: "Pokreće AI — opišite što tražite prirodnim jezikom",
      searching: "Pretražujem…",
    },
    signin: { title: "Dobrodošli natrag", username: "Korisničko ime / Email", password: "Lozinka", button: "Prijava", noAccount: "Nemate račun?", create: "Kreirajte ga" },
    register: { title: "Kreirajte Račun", firstName: "Ime", lastName: "Prezime", username: "Korisničko ime", email: "Email adresa", phone: "Broj telefona", password: "Lozinka", confirm: "Potvrda lozinke", button: "Kreirajte račun", hasAccount: "Već imate račun?", login: "Prijavite se" },
    account: { title: "Moj Račun", firstName: "Ime", lastName: "Prezime", username: "Korisničko ime", email: "Email adresa", phone: "Broj telefona", edit: "Uredi profil", save: "Spremi promjene", cancel: "Odustani", currentPw: "Trenutna lozinka", newPw: "Nova lozinka", confirmPw: "Potvrda nove lozinke", signout: "Odjava", changePw: "Promjena lozinke" },
    signout: { title: "Odjava", message: "Jeste li sigurni da se želite odjaviti?", yes: "Da", no: "Ne" },
    listing: { price: "Cijena", seller: "Podaci o najmodavcu / prodavaču", viewOriginal: "Pogledaj originalni oglas", specs: "Detalji nekretnine", description: "Opis", contact: "Kontaktirajte prodavatelja", back: "Natrag na oglase", backSaved: "Natrag na spremljene oglase" },
  },
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const listings: Listing[] = [
  {
    id: "1", type: "sale",
    title: "Modern Studio in City Center", titleHr: "Moderni studio u centru grada",
    price: "€185,000", location: "Zagreb, Centar",
    images: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&h=600&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&h=600&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&h=600&fit=crop&auto=format",
    ],
    description: "A beautifully appointed studio apartment in the heart of Zagreb. Fully renovated in 2023 with high-end finishes, this property offers excellent value in a prime location. Features include underfloor heating, a modern fitted kitchen, and floor-to-ceiling windows overlooking the city.",
    descriptionHr: "Prekrasno opremljen studio stan u srcu Zagreba. Potpuno renoviran 2023. s vrhunskim materijalima, ova nekretnina nudi izvrsnu vrijednost na premium lokaciji. Značajke uključuju podno grijanje, modernu kuhinju i prozore od poda do stropa s pogledom na grad.",
    specs: [
      { label: "Size", labelHr: "Površina", value: "38 m²" },
      { label: "Floor", labelHr: "Kat", value: "4th of 8", valueHr: "4. od 8" },
      { label: "Year Built", labelHr: "Godina izgradnje", value: "1985 (renovated 2023)", valueHr: "1985. (renovirano 2023.)" },
      { label: "Heating", labelHr: "Grijanje", value: "Underfloor (electric)", valueHr: "Podno (električno)" },
      { label: "Parking", labelHr: "Parking", value: "None", valueHr: "Nema" },
      { label: "Energy Class", labelHr: "Energetski razred", value: "B" },
    ],
    seller: { name: "Ana Kovač", phone: "+385 91 234 5678", email: "ana.kovac@nekretnine.hr", agency: "Zagreb Premium Realty" },
    originalUrl: "https://www.njuskalo.hr",
  },
  {
    id: "2", type: "sale",
    title: "Spacious 2BR with Balcony", titleHr: "Prostrani 2-sobni s balkonom",
    price: "€245,000", location: "Zagreb, Maksimir",
    images: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&h=600&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900&h=600&fit=crop&auto=format",
    ],
    description: "Bright and airy two-bedroom apartment in the sought-after Maksimir neighborhood, just a 5-minute walk from the park. Features a generous 12 m² balcony, separate kitchen, and spacious living room. Well-maintained building with elevator.",
    descriptionHr: "Svijetao i prozračan dvosobni stan u traženom kvartu Maksimir, samo 5 minuta hoda od parka. Stan ima balkon od 12 m², odvojenu kuhinju i prostran dnevni boravak. Dobro održavana zgrada s liftom.",
    specs: [
      { label: "Size", labelHr: "Površina", value: "72 m²" },
      { label: "Bedrooms", labelHr: "Spavaće sobe", value: "2" },
      { label: "Bathrooms", labelHr: "Kupaonice", value: "1" },
      { label: "Floor", labelHr: "Kat", value: "3rd of 6", valueHr: "3. od 6" },
      { label: "Year Built", labelHr: "Godina izgradnje", value: "1994" },
      { label: "Parking", labelHr: "Parking", value: "1 garage space", valueHr: "1 garažno mjesto" },
      { label: "Energy Class", labelHr: "Energetski razred", value: "C" },
    ],
    seller: { name: "Marko Jurić", phone: "+385 98 765 4321", email: "marko.juric@realty.hr", agency: "Maksimir Homes" },
    originalUrl: "https://www.njuskalo.hr",
  },
  {
    id: "3", type: "sale",
    title: "Luxury Penthouse, Panoramic View", titleHr: "Luksuzni penthouse, panoramski pogled",
    price: "€590,000", location: "Zagreb, Gornji Grad",
    images: [
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&h=600&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=900&h=600&fit=crop&auto=format",
    ],
    description: "An exceptional penthouse on the top floor of a prestigious building in Gornji Grad. Offering 360° views of the Zagreb skyline and Cathedral, finished to the highest standard. Features include a private rooftop terrace, smart home system, and two underground parking spaces.",
    descriptionHr: "Izniman penthouse na vrhu prestižne zgrade u Gornjem Gradu. Nudi 360° pogled na panoramu Zagreba i Katedralu, završen prema najvišim standardima. Ima privatnu krovnu terasu, sustav pametnog doma i dva podzemna parkirna mjesta.",
    specs: [
      { label: "Size", labelHr: "Površina", value: "185 m² + 45 m² terrace", valueHr: "185 m² + 45 m² terasa" },
      { label: "Bedrooms", labelHr: "Spavaće sobe", value: "3" },
      { label: "Bathrooms", labelHr: "Kupaonice", value: "2" },
      { label: "Floor", labelHr: "Kat", value: "Penthouse (12th)", valueHr: "Penthouse (12. kat)" },
      { label: "Year Built", labelHr: "Godina izgradnje", value: "2019" },
      { label: "Parking", labelHr: "Parking", value: "2 underground", valueHr: "2 podzemna" },
      { label: "Energy Class", labelHr: "Energetski razred", value: "A+" },
    ],
    seller: { name: "Petra Blažić", phone: "+385 91 987 6543", email: "petra.blazic@luxrealty.hr", agency: "Lux Zagreb Properties" },
    originalUrl: "https://www.njuskalo.hr",
  },
  {
    id: "4", type: "sale",
    title: "Bright 3BR Family Apartment", titleHr: "Svijetli 3-sobni obiteljski stan",
    price: "€320,000", location: "Zagreb, Trnje",
    images: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&h=600&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&h=600&fit=crop&auto=format",
    ],
    description: "A wonderful family apartment in the vibrant Trnje neighborhood, close to schools, shops, and excellent transport links. Three bedrooms, large living and dining area, well-equipped kitchen. The building recently underwent full facade renovation.",
    descriptionHr: "Odličan obiteljski stan u živahnom kvartu Trnje, blizu škola, trgovina i odlične prometne veze. Tri spavaće sobe, velik dnevni boravak i blagovaonica te dobro opremljena kuhinja. Zgrada je nedavno prošla potpunu obnovu pročelja.",
    specs: [
      { label: "Size", labelHr: "Površina", value: "95 m²" },
      { label: "Bedrooms", labelHr: "Spavaće sobe", value: "3" },
      { label: "Bathrooms", labelHr: "Kupaonice", value: "1" },
      { label: "Floor", labelHr: "Kat", value: "2nd of 5", valueHr: "2. od 5" },
      { label: "Year Built", labelHr: "Godina izgradnje", value: "1978 (renovated 2018)", valueHr: "1978. (renovirano 2018.)" },
      { label: "Parking", labelHr: "Parking", value: "1 outdoor space", valueHr: "1 vanjsko mjesto" },
      { label: "Energy Class", labelHr: "Energetski razred", value: "C" },
    ],
    seller: { name: "Ivan Horvat", phone: "+385 95 111 2233", email: "ivan.horvat@dom.hr", agency: "Dom Nekretnine" },
    originalUrl: "https://www.njuskalo.hr",
  },
  {
    id: "5", type: "sale",
    title: "Cozy 1BR near Bundek Lake", titleHr: "Ugodan 1-sobni blizu jezera Bundek",
    price: "€159,000", location: "Zagreb, Bundek",
    images: [
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900&h=600&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&h=600&fit=crop&auto=format",
    ],
    description: "A charming one-bedroom apartment just two blocks from the beautiful Bundek Lake park. Perfect for young professionals or couples. Excellent condition with newly renovated bathroom and kitchen. All amenities within walking distance.",
    descriptionHr: "Šarmantan jednosobni stan samo dva bloka od prekrasnog parka jezera Bundek. Savršen za mlade profesionalce ili parove. Odlično stanje s novom kupaonicom i kuhinjom. Svi sadržaji na pješačkoj udaljenosti.",
    specs: [
      { label: "Size", labelHr: "Površina", value: "48 m²" },
      { label: "Bedrooms", labelHr: "Spavaće sobe", value: "1" },
      { label: "Bathrooms", labelHr: "Kupaonice", value: "1" },
      { label: "Floor", labelHr: "Kat", value: "1st of 4", valueHr: "1. od 4" },
      { label: "Year Built", labelHr: "Godina izgradnje", value: "1988" },
      { label: "Parking", labelHr: "Parking", value: "None", valueHr: "Nema" },
      { label: "Energy Class", labelHr: "Energetski razred", value: "D" },
    ],
    seller: { name: "Maja Šimić", phone: "+385 92 444 5566", email: "maja.simic@stanovi.hr", agency: "Stanovi Zagreb" },
    originalUrl: "https://www.njuskalo.hr",
  },
  {
    id: "6", type: "sale",
    title: "Renovated 4BR Villa with Pool", titleHr: "Renovirana vila s 4 spavaće sobe i bazenom",
    price: "€875,000", location: "Zagreb, Šestine",
    images: [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=900&h=600&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=900&h=600&fit=crop&auto=format",
    ],
    description: "A stunning detached villa on the forested slopes of Medvednica, offering complete privacy while remaining only 15 minutes from the city center. Recently renovated throughout with four spacious bedrooms, a large garden, swimming pool, and double garage.",
    descriptionHr: "Prekrasna samostojeća vila na šumovitim obroncima Medvednice, koja nudi potpunu privatnost uz samo 15 minuta od centra. Nedavno u potpunosti renovirana, ima četiri prostrane spavaće sobe, veliki vrt, bazen i dvostruku garažu.",
    specs: [
      { label: "Size", labelHr: "Površina", value: "285 m² + 850 m² garden", valueHr: "285 m² + 850 m² vrt" },
      { label: "Bedrooms", labelHr: "Spavaće sobe", value: "4" },
      { label: "Bathrooms", labelHr: "Kupaonice", value: "3" },
      { label: "Stories", labelHr: "Katovi", value: "2 + basement", valueHr: "2 + podrum" },
      { label: "Year Built", labelHr: "Godina izgradnje", value: "2001 (renovated 2022)", valueHr: "2001. (renovirano 2022.)" },
      { label: "Parking", labelHr: "Parking", value: "Double garage + driveway", valueHr: "Dvostruka garaža + prilaz" },
      { label: "Energy Class", labelHr: "Energetski razred", value: "B" },
    ],
    seller: { name: "Tomislav Babić", phone: "+385 91 777 8899", email: "tomislav.babic@vilarealty.hr", agency: "Villa Zagreb" },
    originalUrl: "https://www.njuskalo.hr",
  },
  {
    id: "7", type: "rent",
    title: "Furnished Studio, Bills Included", titleHr: "Namješteni studio, režije uključene",
    price: "€650/mo", location: "Zagreb, Centar",
    images: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&h=600&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&h=600&fit=crop&auto=format",
    ],
    description: "A cozy and fully furnished studio apartment in the heart of Zagreb, with all utility bills included in the rent. Ideal for students, interns, or professionals on short-term assignments. Just 5 minutes from Ban Jelačić Square with excellent public transport access.",
    descriptionHr: "Ugodan i potpuno namješten studio stan u srcu Zagreba, s uključenim svim režijama u najamninu. Idealno za studente, praktikante ili profesionalce. Samo 5 minuta od Trga bana Jelačića s odličnim javnim prijevozom.",
    specs: [
      { label: "Size", labelHr: "Površina", value: "32 m²" },
      { label: "Furnished", labelHr: "Namještaj", value: "Fully furnished", valueHr: "Potpuno namješteno" },
      { label: "Bills", labelHr: "Režije", value: "All included", valueHr: "Sve uključeno" },
      { label: "Floor", labelHr: "Kat", value: "2nd of 5", valueHr: "2. od 5" },
      { label: "Min. Lease", labelHr: "Min. najam", value: "3 months", valueHr: "3 mjeseca" },
      { label: "Available", labelHr: "Dostupno", value: "Immediately", valueHr: "Odmah" },
    ],
    seller: { name: "Lucia Modrić", phone: "+385 99 123 4567", email: "lucia.modric@rent.hr", agency: "Zagreb Rentals" },
    originalUrl: "https://www.njuskalo.hr",
  },
  {
    id: "8", type: "rent",
    title: "Modern 2BR near Tram Stop", titleHr: "Moderni 2-sobni blizu tramvajske stanice",
    price: "€900/mo", location: "Zagreb, Novi Zagreb",
    images: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&h=600&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900&h=600&fit=crop&auto=format",
    ],
    description: "A modern two-bedroom apartment in Novi Zagreb, just 200 meters from the tram stop with direct connections to the city center. Contemporary open-plan living area, fully equipped kitchen, and a sunny terrace. One covered parking space included.",
    descriptionHr: "Moderni dvosobni stan u Novom Zagrebu, samo 200 metara od tramvajske stanice s izravnim vezama prema centru. Suvremeni otvoreni dnevni boravak, potpuno opremljena kuhinja i sunčana terasa. Uključeno jedno natkriveno parkirno mjesto.",
    specs: [
      { label: "Size", labelHr: "Površina", value: "68 m²" },
      { label: "Bedrooms", labelHr: "Spavaće sobe", value: "2" },
      { label: "Furnished", labelHr: "Namještaj", value: "Partially furnished", valueHr: "Djelomično namješteno" },
      { label: "Parking", labelHr: "Parking", value: "1 covered space", valueHr: "1 natkriveno mjesto" },
      { label: "Min. Lease", labelHr: "Min. najam", value: "12 months", valueHr: "12 mjeseci" },
      { label: "Available", labelHr: "Dostupno", value: "July 1, 2025", valueHr: "1. srpnja 2025." },
    ],
    seller: { name: "Davor Knežević", phone: "+385 91 555 6677", email: "davor.knezevic@novizbg.hr", agency: "Novi Zagreb Realty" },
    originalUrl: "https://www.njuskalo.hr",
  },
  {
    id: "9", type: "rent",
    title: "Sunny 1BR with Garden Access", titleHr: "Sunčan 1-sobni s pristupom vrtu",
    price: "€750/mo", location: "Zagreb, Maksimir",
    images: [
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=900&h=600&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&h=600&fit=crop&auto=format",
    ],
    description: "A delightful ground-floor apartment in a low-rise building in Maksimir, featuring direct access to a shared garden. Bright and sunny throughout the day, recently repainted with updated bathroom fixtures. Close to Maksimir Park and Zagreb Zoo.",
    descriptionHr: "Divan prizemni stan u niskokatnoj zgradi u Maksimiru, s izravnim pristupom zajedničkom vrtu. Svijetao i sunčan cijeli dan, nedavno obojan s obnovljenom opremom kupaonice. Blizu parka Maksimir i Zoološkog vrta.",
    specs: [
      { label: "Size", labelHr: "Površina", value: "52 m²" },
      { label: "Bedrooms", labelHr: "Spavaće sobe", value: "1" },
      { label: "Furnished", labelHr: "Namještaj", value: "Fully furnished", valueHr: "Potpuno namješteno" },
      { label: "Garden", labelHr: "Vrt", value: "Shared access", valueHr: "Zajednički pristup" },
      { label: "Pets", labelHr: "Kućni ljubimci", value: "Allowed", valueHr: "Dozvoljeno" },
      { label: "Available", labelHr: "Dostupno", value: "Immediately", valueHr: "Odmah" },
    ],
    seller: { name: "Helena Vidović", phone: "+385 95 888 9900", email: "helena.vidovic@maks.hr", agency: "Maksimir Living" },
    originalUrl: "https://www.njuskalo.hr",
  },
  {
    id: "10", type: "rent",
    title: "Executive Apartment with Parking", titleHr: "Poslovni stan s parkingom",
    price: "€1,200/mo", location: "Zagreb, Gornji Grad",
    images: [
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&h=600&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&h=600&fit=crop&auto=format",
    ],
    description: "A premium executive apartment in the prestigious Gornji Grad district, ideal for executives and diplomats. Fully furnished to a high standard with designer furniture, smart home automation, and concierge service. Two underground parking spaces and private storage included.",
    descriptionHr: "Premium poslovni stan u prestižnom kvartu Gornji Grad, idealan za poslovnjake i diplomate. Potpuno namješten s dizajnerskim namještajem, automatizacijom pametnog doma i uslugom portira. Uključena dva podzemna parkirna mjesta i privatna ostava.",
    specs: [
      { label: "Size", labelHr: "Površina", value: "120 m²" },
      { label: "Bedrooms", labelHr: "Spavaće sobe", value: "2" },
      { label: "Furnished", labelHr: "Namještaj", value: "Luxury furnished", valueHr: "Luksuzno namješteno" },
      { label: "Parking", labelHr: "Parking", value: "2 underground spaces", valueHr: "2 podzemna mjesta" },
      { label: "Smart Home", labelHr: "Pametni dom", value: "Full automation", valueHr: "Potpuna automatizacija" },
      { label: "Min. Lease", labelHr: "Min. najam", value: "6 months", valueHr: "6 mjeseci" },
    ],
    seller: { name: "Robert Grgić", phone: "+385 91 000 1122", email: "robert.grgic@luxrent.hr", agency: "Lux Zagreb Rentals" },
    originalUrl: "https://www.njuskalo.hr",
  },
  {
    id: "11", type: "rent",
    title: "Cozy Attic Flat in Old Town", titleHr: "Ugodan mansardni stan u Starom gradu",
    price: "€580/mo", location: "Zagreb, Gornji Grad",
    images: [
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900&h=600&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&h=600&fit=crop&auto=format",
    ],
    description: "A unique attic apartment in a historic building in Zagreb's old town, featuring original wooden beams, exposed brick, and sloped ceilings that give it a unique character. Compact but thoughtfully designed. A great opportunity to experience life in the historic upper town.",
    descriptionHr: "Jedinstven mansardni stan u povijesnoj zgradi u starom gradu Zagreba, s originalnim drvenim gredama, izloženom ciglom i kosim stropovima koji mu daju poseban karakter. Kompaktan ali promišljeno dizajniran. Odlična prilika za doživljaj života u gornjem gradu.",
    specs: [
      { label: "Size", labelHr: "Površina", value: "41 m²" },
      { label: "Bedrooms", labelHr: "Spavaće sobe", value: "1" },
      { label: "Furnished", labelHr: "Namještaj", value: "Furnished", valueHr: "Namješteno" },
      { label: "Building", labelHr: "Zgrada", value: "Historic (19th c.)", valueHr: "Povijesna (19. st.)" },
      { label: "Pets", labelHr: "Kućni ljubimci", value: "On request", valueHr: "Na upit" },
      { label: "Available", labelHr: "Dostupno", value: "August 1, 2025", valueHr: "1. kolovoza 2025." },
    ],
    seller: { name: "Mia Bogdanović", phone: "+385 98 333 4455", email: "mia.bogdanovic@starigrad.hr", agency: "Old Town Rentals" },
    originalUrl: "https://www.njuskalo.hr",
  },
  {
    id: "12", type: "rent",
    title: "3BR Family Home near Schools", titleHr: "3-sobna obiteljska kuća blizu škola",
    price: "€1,100/mo", location: "Zagreb, Trnje",
    images: [
      "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=900&h=600&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&h=600&fit=crop&auto=format",
    ],
    description: "A spacious three-bedroom house in family-friendly Trnje, within the catchment of several highly-rated schools. Features a private garden, garage, and a large basement. Well-maintained and offers plenty of space for a growing family.",
    descriptionHr: "Prostrana trosemestrana kuća u obiteljski orijentiranom kvartu Trnje, u blizini nekoliko visoko ocijenjenih škola. Ima privatni vrt, garažu i veliku podrumsku prostoriju. Dobro održavana s puno prostora za rastuću obitelj.",
    specs: [
      { label: "Size", labelHr: "Površina", value: "145 m² + garden", valueHr: "145 m² + vrt" },
      { label: "Bedrooms", labelHr: "Spavaće sobe", value: "3" },
      { label: "Bathrooms", labelHr: "Kupaonice", value: "2" },
      { label: "Garden", labelHr: "Vrt", value: "Private, 200 m²", valueHr: "Privatni, 200 m²" },
      { label: "Parking", labelHr: "Parking", value: "Garage + driveway", valueHr: "Garaža + prilaz" },
      { label: "Min. Lease", labelHr: "Min. najam", value: "12 months", valueHr: "12 mjeseci" },
    ],
    seller: { name: "Stjepan Filipović", phone: "+385 91 666 7788", email: "stjepan.filipovic@dom.hr", agency: "Dom Nekretnine" },
    originalUrl: "https://www.njuskalo.hr",
  },
];

// ─── Shared Components ────────────────────────────────────────────────────────

function HeartButton({ saved, onToggle, size = "sm" }: { saved: boolean; onToggle: (e: React.MouseEvent) => void; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "w-10 h-10" : "w-8 h-8";
  const iconSize = size === "lg" ? 20 : 16;
  return (
    <button
      onClick={onToggle}
      className={`${dim} flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${
        saved ? "bg-pink-100 dark:bg-pink-900/30" : "bg-white/80 dark:bg-gray-800/80"
      } shadow-sm`}
      aria-label={saved ? "Remove from saved" : "Save listing"}
    >
      <Heart
        size={iconSize}
        className={saved ? "fill-pink-500 stroke-pink-500" : "fill-none stroke-pink-400"}
        strokeWidth={2}
      />
    </button>
  );
}

function ListingCard({
  listing, saved, lang, onSave, onOpen,
}: {
  listing: Listing; saved: boolean; lang: Lang;
  onSave: (id: string) => void; onOpen: (l: Listing) => void;
}) {
  const title = lang === "en" ? listing.title : listing.titleHr;
  return (
    <div
      className="bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group"
      onClick={() => onOpen(listing)}
    >
      <div className="relative aspect-[4/3] bg-purple-50 dark:bg-purple-900/20 overflow-hidden">
        <img
          src={listing.images[0]}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute bottom-2.5 right-2.5">
          <HeartButton
            saved={saved}
            onToggle={(e) => { e.stopPropagation(); onSave(listing.id); }}
          />
        </div>
        <div className="absolute top-2.5 left-2.5">
          <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
            listing.type === "sale"
              ? "bg-purple-100/90 text-purple-700 dark:bg-purple-900/70 dark:text-purple-300"
              : "bg-pink-100/90 text-pink-700 dark:bg-pink-900/70 dark:text-pink-300"
          }`}>
            {listing.type === "sale" ? (lang === "en" ? "For Sale" : "Prodaja") : (lang === "en" ? "For Rent" : "Najam")}
          </span>
        </div>
      </div>
      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{listing.location}</p>
        <h3 className="font-bold text-foreground text-sm leading-snug mb-2 line-clamp-2">{title}</h3>
        <p className="font-extrabold text-base" style={{ color: "var(--primary)" }}>{listing.price}</p>
      </div>
    </div>
  );
}

function InputField({ label, type = "text", value, onChange, placeholder }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-input-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-700 transition-all"
      />
    </div>
  );
}

function GradientButton({ onClick, children, className = "" }: { onClick?: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] ${className}`}
      style={{ background: "linear-gradient(135deg, #7B6FC4 0%, #C084A0 100%)" }}
    >
      {children}
    </button>
  );
}

// ─── Page: Home ───────────────────────────────────────────────────────────────

function HomePage({
  lang, savedIds, toggleSaved, openListing, setPage,
}: {
  lang: Lang; savedIds: Set<string>; toggleSaved: (id: string) => void;
  openListing: (l: Listing) => void; setPage: (p: Page) => void;
}) {
  const tr = translations[lang];
  const saleListings = listings.filter((l) => l.type === "sale");
  const rentListings = listings.filter((l) => l.type === "rent");
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Hero */}
      <div className="mb-14 relative overflow-hidden rounded-3xl p-10 sm:p-16 text-center"
        style={{ background: "linear-gradient(135deg, #EDE9F8 0%, #F7D4DE 50%, #D4E4F8 100%)" }}>
        <div className="dark:hidden absolute inset-0 rounded-3xl" style={{ background: "linear-gradient(135deg, #EDE9F8 0%, #F7D4DE 50%, #D4E4F8 100%)" }} />
        <div className="hidden dark:block absolute inset-0 rounded-3xl" style={{ background: "linear-gradient(135deg, #1E1A35 0%, #2A1A28 50%, #1A1E2E 100%)" }} />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 dark:bg-white/10 text-purple-700 dark:text-purple-300 text-xs font-semibold mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            {lang === "en" ? "Real Estate in Croatia" : "Nekretnine u Hrvatskoj"}
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground mb-4 tracking-tight leading-tight">
            {tr.hero.title}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">{tr.hero.subtitle}</p>
          <div className="flex gap-3 justify-center mt-8">
            <button
              onClick={() => setPage("buy")}
              className="px-7 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #7B6FC4 0%, #9B6FC4 100%)" }}
            >
              {lang === "en" ? "Browse to Buy" : "Pregledaj kupnju"}
            </button>
            <button
              onClick={() => setPage("rent")}
              className="px-7 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #C084A0 0%, #E891A0 100%)" }}
            >
              {lang === "en" ? "Browse to Rent" : "Pregledaj najam"}
            </button>
          </div>
        </div>
      </div>

      {/* For Sale */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold text-foreground">{tr.forSale}</h2>
          <button onClick={() => setPage("buy")} className="text-sm font-semibold hover:underline" style={{ color: "var(--primary)" }}>
            {tr.viewAll}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {saleListings.map((l) => (
            <ListingCard key={l.id} listing={l} saved={savedIds.has(l.id)} lang={lang} onSave={toggleSaved} onOpen={openListing} />
          ))}
        </div>
      </section>

      {/* For Rent */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold text-foreground">{tr.forRent}</h2>
          <button onClick={() => setPage("rent")} className="text-sm font-semibold hover:underline" style={{ color: "var(--primary)" }}>
            {tr.viewAll}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {rentListings.map((l) => (
            <ListingCard key={l.id} listing={l} saved={savedIds.has(l.id)} lang={lang} onSave={toggleSaved} onOpen={openListing} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Page: Browse (Buy / Rent) ────────────────────────────────────────────────

function BrowsePage({
  type, lang, savedIds, toggleSaved, openListing,
}: {
  type: "sale" | "rent"; lang: Lang; savedIds: Set<string>;
  toggleSaved: (id: string) => void; openListing: (l: Listing) => void;
}) {
  const tr = translations[lang];
  const [sortBy, setSortBy] = useState("newest");
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const priceValue = (p: string) => Number(p.replace(/[^0-9]/g, "")) || 0;
  const filtered = listings.filter((l) => l.type === type);
  const base = [...filtered].sort((a, b) => {
    if (sortBy === "priceLow") return priceValue(a.price) - priceValue(b.price);
    if (sortBy === "priceHigh") return priceValue(b.price) - priceValue(a.price);
    return 0; // "newest" keeps the original order
  });

  const handleAiSearch = () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setTimeout(() => {
      const count = Math.floor(Math.random() * 4) + 2;
      setAiResponse(
        lang === "en"
          ? `Based on "${aiQuery}", I found ${count} matching properties. Results are filtered by relevance to your description.`
          : `Na osnovu "${aiQuery}", pronašao sam ${count} odgovarajućih nekretnina. Rezultati su filtrirani prema relevantnosti.`
      );
      setAiLoading(false);
    }, 1400);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Sort bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <SlidersHorizontal size={15} className="text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground font-semibold">{tr.sort.label}:</span>
        {(["newest", "priceLow", "priceHigh"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              sortBy === s
                ? "border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            style={sortBy === s ? { background: "rgba(123,111,196,0.12)" } : {}}
          >
            {tr.sort[s]}
          </button>
        ))}
      </div>

      <div className="flex gap-6 items-start">
        {/* Grid */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {base.map((l) => (
              <ListingCard key={l.id} listing={l} saved={savedIds.has(l.id)} lang={lang} onSave={toggleSaved} onOpen={openListing} />
            ))}
          </div>
        </div>

        {/* AI Panel */}
        <aside className="hidden lg:block w-76 shrink-0">
          <div className="sticky top-24 bg-card rounded-2xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7B6FC4, #C084A0)" }}>
                <Search size={14} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm leading-tight">{tr.ai.title}</h3>
              </div>
            </div>
            <textarea
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder={tr.ai.placeholder}
              rows={5}
              onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleAiSearch(); }}
              className="w-full resize-none rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-700 transition-all mb-3 leading-relaxed"
            />
            <button
              onClick={handleAiSearch}
              disabled={aiLoading || !aiQuery.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #7B6FC4 0%, #C084A0 100%)" }}
            >
              <Send size={13} />
              {aiLoading ? tr.ai.searching : tr.ai.send}
            </button>
            {aiResponse && (
              <div className="mt-4 p-3 rounded-xl border text-xs leading-relaxed"
                style={{ background: "rgba(123,111,196,0.08)", borderColor: "rgba(123,111,196,0.2)", color: "var(--primary)" }}>
                {aiResponse}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-3 text-center leading-relaxed">{tr.ai.hint}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Page: Saved Listings ─────────────────────────────────────────────────────

function SavedPage({
  lang, savedIds, toggleSaved, openListing, setPage,
}: {
  lang: Lang; savedIds: Set<string>; toggleSaved: (id: string) => void;
  openListing: (l: Listing) => void; setPage: (p: Page) => void;
}) {
  const tr = translations[lang];
  const saved = listings.filter((l) => savedIds.has(l.id));
  const savedSale = saved.filter((l) => l.type === "sale");
  const savedRent = saved.filter((l) => l.type === "rent");

  if (saved.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "linear-gradient(135deg, #F7D4DE, #EDE9F8)" }}>
          <Bookmark size={32} className="text-pink-400" />
        </div>
        <h2 className="text-2xl font-extrabold text-foreground mb-2">{tr.saved.empty}</h2>
        <p className="text-muted-foreground mb-10 max-w-sm">{tr.saved.emptyHint}</p>
        <div className="flex gap-4">
          <button
            onClick={() => setPage("buy")}
            className="px-10 py-3.5 rounded-2xl font-bold text-white text-sm transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7B6FC4, #9B6FC4)" }}
          >
            {tr.saved.buy}
          </button>
          <button
            onClick={() => setPage("rent")}
            className="px-10 py-3.5 rounded-2xl font-bold text-white text-sm transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #C084A0, #E891A0)" }}
          >
            {tr.saved.rent}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {savedSale.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-extrabold text-foreground mb-6">{tr.saved.saleSection}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {savedSale.map((l) => (
              <ListingCard key={l.id} listing={l} saved={true} lang={lang} onSave={toggleSaved} onOpen={openListing} />
            ))}
          </div>
        </section>
      )}
      {savedRent.length > 0 && (
        <section>
          <h2 className="text-2xl font-extrabold text-foreground mb-6">{tr.saved.rentSection}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {savedRent.map((l) => (
              <ListingCard key={l.id} listing={l} saved={true} lang={lang} onSave={toggleSaved} onOpen={openListing} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Page: Sign In ────────────────────────────────────────────────────────────

function SignInPage({
  lang, onSignIn, setPage,
}: {
  lang: Lang; onSignIn: () => void; setPage: (p: Page) => void;
}) {
  const tr = translations[lang];
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-3xl border border-border p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg, #7B6FC4, #C084A0)" }}>
              <LogIn size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground">{tr.signin.title}</h1>
          </div>
          <div className="space-y-4">
            <InputField label={tr.signin.username} value={username} onChange={setUsername} />
            <InputField label={tr.signin.password} type="password" value={password} onChange={setPassword} />
            <GradientButton onClick={onSignIn} className="w-full mt-2">{tr.signin.button}</GradientButton>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-6">
            {tr.signin.noAccount}{" "}
            <button onClick={() => setPage("register")} className="font-semibold hover:underline" style={{ color: "var(--primary)" }}>
              {tr.signin.create}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page: Register ───────────────────────────────────────────────────────────

function RegisterPage({
  lang, onRegister, setPage,
}: {
  lang: Lang; onRegister: () => void; setPage: (p: Page) => void;
}) {
  const tr = translations[lang];
  const [form, setForm] = useState({ firstName: "", lastName: "", username: "", email: "", phone: "", password: "", confirm: "" });
  const set = (key: keyof typeof form) => (v: string) => setForm({ ...form, [key]: v });
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-3xl border border-border p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg, #7B6FC4, #C084A0)" }}>
              <User size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground">{tr.register.title}</h1>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <InputField label={tr.register.firstName} value={form.firstName} onChange={set("firstName")} />
              <InputField label={tr.register.lastName} value={form.lastName} onChange={set("lastName")} />
            </div>
            <InputField label={tr.register.username} value={form.username} onChange={set("username")} />
            <InputField label={tr.register.email} type="email" value={form.email} onChange={set("email")} />
            <InputField label={tr.register.phone} type="tel" value={form.phone} onChange={set("phone")} />
            <InputField label={tr.register.password} type="password" value={form.password} onChange={set("password")} />
            <InputField label={tr.register.confirm} type="password" value={form.confirm} onChange={set("confirm")} />
            <GradientButton onClick={onRegister} className="w-full mt-2">{tr.register.button}</GradientButton>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-6">
            {tr.register.hasAccount}{" "}
            <button onClick={() => setPage("signin")} className="font-semibold hover:underline" style={{ color: "var(--primary)" }}>
              {tr.register.login}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page: Account ────────────────────────────────────────────────────────────

function AccountPage({
  lang, onSignOut,
}: {
  lang: Lang; onSignOut: () => void;
}) {
  const tr = translations[lang];
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: "Marija", lastName: "Horvat", username: "marijahorvat",
    email: "marija.horvat@email.com", phone: "+385 91 234 5678",
  });
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold shadow-md"
          style={{ background: "linear-gradient(135deg, #7B6FC4, #C084A0)" }}>
          {form.firstName[0]}
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{tr.account.title}</h1>
          <p className="text-muted-foreground text-sm">@{form.username}</p>
        </div>
      </div>

      <div className="bg-card rounded-3xl border border-border p-6 space-y-4">
        {([
          ["firstName", tr.account.firstName],
          ["lastName", tr.account.lastName],
          ["username", tr.account.username],
          ["email", tr.account.email],
          ["phone", tr.account.phone],
        ] as [keyof typeof form, string][]).map(([key, label]) => (
          <div key={key}>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</label>
            {editing ? (
              <input
                type="text"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full rounded-xl border border-border bg-input-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-700 transition-all"
              />
            ) : (
              <p className="text-sm font-semibold text-foreground py-2.5 px-4 rounded-xl bg-muted/50">{form[key]}</p>
            )}
          </div>
        ))}

        {editing && (
          <div className="border-t border-border pt-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground">{tr.account.changePw}</h3>
            {([
              ["current", tr.account.currentPw],
              ["newPw", tr.account.newPw],
              ["confirm", tr.account.confirmPw],
            ] as [keyof typeof pwForm, string][]).map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</label>
                <input
                  type="password"
                  value={pwForm[key]}
                  onChange={(e) => setPwForm({ ...pwForm, [key]: e.target.value })}
                  className="w-full rounded-xl border border-border bg-input-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-700 transition-all"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          {editing ? (
            <>
              <GradientButton onClick={() => setEditing(false)} className="flex-1">{tr.account.save}</GradientButton>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-3 rounded-xl border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors"
              >
                {tr.account.cancel}
              </button>
            </>
          ) : (
            <GradientButton onClick={() => setEditing(true)} className="flex-1">{tr.account.edit}</GradientButton>
          )}
        </div>
      </div>

      <button
        onClick={onSignOut}
        className="mt-4 w-full py-2.5 rounded-xl border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/5 transition-colors"
      >
        {tr.account.signout}
      </button>
    </div>
  );
}

// ─── Page: Listing Detail ─────────────────────────────────────────────────────

function ListingDetailPage({
  listing, lang, saved, toggleSaved, setPage, backPage,
}: {
  listing: Listing; lang: Lang; saved: boolean;
  toggleSaved: (id: string) => void; setPage: (p: Page) => void; backPage: Page;
}) {
  const tr = translations[lang];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [listing.id]);

  const title = lang === "en" ? listing.title : listing.titleHr;
  const description = lang === "en" ? listing.description : listing.descriptionHr;
  const prev = () => setIdx((i) => (i - 1 + listing.images.length) % listing.images.length);
  const next = () => setIdx((i) => (i + 1) % listing.images.length);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <button
        onClick={() => setPage(backPage)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors font-medium"
      >
        <ChevronLeft size={15} /> {backPage === "saved" ? tr.listing.backSaved : tr.listing.back}
      </button>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground leading-tight tracking-tight">{title}</h1>
        <HeartButton
          saved={saved}
          onToggle={(e) => { e.preventDefault(); toggleSaved(listing.id); }}
          size="lg"
        />
      </div>
      <p className="text-sm text-muted-foreground mb-2">{listing.location}</p>
      <p className="text-2xl font-extrabold mb-8" style={{ color: "var(--primary)" }}>{listing.price}</p>

      {/* Gallery */}
      <div className="mb-10 rounded-3xl overflow-hidden bg-purple-50 dark:bg-purple-900/20 relative aspect-video shadow-sm">
        <img src={listing.images[idx]} alt={title} className="w-full h-full object-cover" />
        {listing.images.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 dark:bg-gray-900/80 shadow hover:bg-white dark:hover:bg-gray-900 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 dark:bg-gray-900/80 shadow hover:bg-white dark:hover:bg-gray-900 transition-colors">
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {listing.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`rounded-full transition-all duration-200 ${i === idx ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/50"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section>
            <h2 className="text-xl font-extrabold text-foreground mb-3">{tr.listing.description}</h2>
            <p className="text-muted-foreground leading-relaxed">{description}</p>
          </section>
          <section>
            <h2 className="text-xl font-extrabold text-foreground mb-4">{tr.listing.specs}</h2>
            <div className="rounded-2xl border border-border overflow-hidden">
              <table className="w-full">
                <tbody>
                  {listing.specs.map(({ label, labelHr, value, valueHr }, i) => (
                    <tr key={label} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                      <td className="px-5 py-3 text-sm text-muted-foreground font-medium w-1/2">{lang === "en" ? label : labelHr}</td>
                      <td className="px-5 py-3 text-sm text-foreground font-bold">{lang === "en" ? value : (valueHr ?? value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <a
            href={listing.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold hover:underline"
            style={{ color: "var(--primary)" }}
          >
            <ExternalLink size={14} /> {tr.listing.viewOriginal}
          </a>
        </div>

        {/* Seller panel */}
        <aside>
          <div className="sticky top-24 bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h3 className="font-extrabold text-foreground text-sm mb-5">{tr.listing.seller}</h3>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                style={{ background: "linear-gradient(135deg, #7B6FC4, #C084A0)" }}>
                {listing.seller.name[0]}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-foreground text-sm">{listing.seller.name}</p>
                <p className="text-xs text-muted-foreground truncate">{listing.seller.agency}</p>
              </div>
            </div>
            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Phone size={13} className="shrink-0 text-purple-400" />
                <span className="text-xs">{listing.seller.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Mail size={13} className="shrink-0 text-pink-400" />
                <span className="text-xs break-all">{listing.seller.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Building2 size={13} className="shrink-0 text-purple-400" />
                <span className="text-xs">{listing.seller.agency}</span>
              </div>
            </div>
            <GradientButton className="w-full">{tr.listing.contact}</GradientButton>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [lang, setLang] = useState<Lang>("en");
  const [dark, setDark] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [activeListing, setActiveListing] = useState<Listing | null>(null);
  const [listingOrigin, setListingOrigin] = useState<Page>("home");
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tr = translations[lang];

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    document.documentElement.style.fontFamily = "'Manrope', sans-serif";
  }, []);

  const toggleSaved = (id: string) => {
    if (!isLoggedIn) { setPage("signin"); return; }
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openListing = (l: Listing) => {
    setActiveListing(l);
    setListingOrigin(page === "listing" ? listingOrigin : page);
    setPage("listing");
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const handleSignIn = () => { setIsLoggedIn(true); setPage("home"); };
  const handleSignOut = () => {
    setIsLoggedIn(false);
    setSavedIds(new Set());
    setShowSignOutModal(false);
    setPage("home");
  };

  const navItems = [
    { key: "home", label: tr.nav.home },
    { key: "buy", label: tr.nav.buy },
    { key: "rent", label: tr.nav.rent },
    ...(isLoggedIn ? [{ key: "saved", label: tr.nav.saved }] : []),
  ];

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <button
            onClick={() => setPage("home")}
            className="flex items-center gap-2 shrink-0"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: "linear-gradient(135deg, #7B6FC4, #C084A0)" }}>
              <Home size={16} className="text-white" />
            </div>
            <span className="font-extrabold text-lg text-foreground tracking-tight hidden sm:block">Domovi</span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {navItems.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPage(key as Page)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  page === key
                    ? "text-purple-700 dark:text-purple-300"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                style={page === key ? { background: "rgba(123,111,196,0.12)" } : {}}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setLang(lang === "en" ? "hr" : "en")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <Globe size={13} />
              {lang === "en" ? "HR" : "EN"}
            </button>
            <button
              onClick={() => setDark(!dark)}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {isLoggedIn ? (
              <>
                <button
                  onClick={() => setPage("account")}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ background: "linear-gradient(135deg, #7B6FC4, #C084A0)" }}>
                    M
                  </div>
                  {tr.nav.account}
                </button>
                <button
                  onClick={() => setShowSignOutModal(true)}
                  className="hidden md:flex w-9 h-9 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                  title={tr.account.signout}
                >
                  <LogOut size={15} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setPage("signin")}
                  className="hidden md:block px-4 py-1.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  {tr.nav.signin}
                </button>
                <button
                  onClick={() => setPage("register")}
                  className="hidden md:block px-4 py-1.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #7B6FC4, #C084A0)" }}
                >
                  {tr.nav.register}
                </button>
              </>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              {mobileMenuOpen ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background px-4 py-3 space-y-1">
            {[
              ...navItems,
              ...(isLoggedIn
                ? [{ key: "account", label: tr.nav.account }]
                : [{ key: "signin", label: tr.nav.signin }, { key: "register", label: tr.nav.register }]
              ),
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setPage(key as Page); setMobileMenuOpen(false); }}
                className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {label}
              </button>
            ))}
            {isLoggedIn && (
              <button
                onClick={() => { setShowSignOutModal(true); setMobileMenuOpen(false); }}
                className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {tr.account.signout}
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main */}
      <main>
        {page === "home" && (
          <HomePage lang={lang} savedIds={savedIds} toggleSaved={toggleSaved} openListing={openListing} setPage={setPage} />
        )}
        {page === "buy" && (
          <BrowsePage type="sale" lang={lang} savedIds={savedIds} toggleSaved={toggleSaved} openListing={openListing} />
        )}
        {page === "rent" && (
          <BrowsePage type="rent" lang={lang} savedIds={savedIds} toggleSaved={toggleSaved} openListing={openListing} />
        )}
        {page === "saved" && isLoggedIn && (
          <SavedPage lang={lang} savedIds={savedIds} toggleSaved={toggleSaved} openListing={openListing} setPage={setPage} />
        )}
        {page === "signin" && (
          <SignInPage lang={lang} onSignIn={handleSignIn} setPage={setPage} />
        )}
        {page === "register" && (
          <RegisterPage lang={lang} onRegister={handleSignIn} setPage={setPage} />
        )}
        {page === "account" && isLoggedIn && (
          <AccountPage lang={lang} onSignOut={() => setShowSignOutModal(true)} />
        )}
        {page === "listing" && activeListing && (
          <ListingDetailPage
            listing={activeListing}
            lang={lang}
            saved={savedIds.has(activeListing.id)}
            toggleSaved={toggleSaved}
            setPage={setPage}
            backPage={listingOrigin}
          />
        )}
      </main>

      {/* Sign Out Modal */}
      {showSignOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-card rounded-3xl p-8 shadow-2xl border border-border w-full max-w-sm">
            <h2 className="text-xl font-extrabold text-foreground mb-3">{tr.signout.title}</h2>
            <p className="text-muted-foreground mb-7 leading-relaxed">{tr.signout.message}</p>
            <div className="flex gap-3">
              <GradientButton onClick={handleSignOut} className="flex-1">{tr.signout.yes}</GradientButton>
              <button
                onClick={() => setShowSignOutModal(false)}
                className="flex-1 py-3 rounded-xl border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors"
              >
                {tr.signout.no}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
