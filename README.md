# 💰 Finance Money Manager - Netlify Web App

Netlify va zamonaviy veb-brauzerlar uchun maxsus yaratilgan to'liq mustaqil (Serverless), xavfsiz va qulay shaxsiy moliya boshqaruv veb-ilovasi.

---

## 🌟 Imkoniyatlari:

1. **💳 Hisoblar Boshqaruvi (Accounts):**
   - **Bank Kartalari (Card):** Uzcard, Humo, Visa va h.k.
   - **Naqd Pul (Cash):** Hamyon yoki seyfdagi naqd pullar.
   - **Omonat / Depozit (Deposit):** Yillik foiz stavkasi (%) va muddati bilan jamg'arma hisob-kitobi.
   - Yangi hisoblar qo'shish, tahrirlash, ranglar va balanslarni boshqarish.

2. **⚡️ Operatsiyalar Turlari:**
   - ➕ **Kirim (Income):** Oylik maosh, biznes, sovg'a va boshqa daromadlar.
   - ➖ **Chiqim (Expense):** Oziq-ovqat, transport, xaridlar, kommunal va h.k.
   - ⇄ **O'tkazma (Transfer):** Hisoblar orasida mablag' ko'chirish (masalan, Kartadan Naqdga).
   - 🏦 **Omonat Operatsiyalari (Deposit):** Omonatni to'ldirish, qisman yechish va foiz daromadini kiritish.

3. **📜 Tarix va Kengaytirilgan Filtrlar:**
   - To'liq qidiruv (izoh, kategoriya yoki summa bo'yicha).
   - Vaqt filtrlari: Bugun, Kecha, Bu hafta, Bu oy, Shu yil, Maxsus sana oralig'i (Dan ... Gacha).
   - Turlar, Hisoblar va Kategoriyalar bo'yicha ajratish.
   - Barcha operatsiyalarni **Excel / CSV** formatida yuklab olish.

4. **📈 Grafik va Tahlil (Analytics):**
   - Kirim va Chiqim balansi diagrammasi.
   - Kategoriyalar bo'yicha foizli xarajatlar taqsimoti (Chart.js).

5. **💾 JSON Baza & Zaxira Nusxa (Backup & Restore):**
   - 100% brauzerda (LocalStorage/JSON Store) saqlanadi.
   - Barcha hisoblar va tarixingizni bitta tugma orqali `.json` fayl sifatida kompyuter/telefonga yuklab olish va istalgan payt qayta tiklash.

6. **🔒 Xavfsizlik (PIN Qulf):**
   - Ixtiyoriy 4 xonali PIN-kod o'rnatish imkoniyati.

---

## 🚀 Netlify-ga Joylash (Deployment Guide):

### 1-USUL: Drag & Drop (1 Daqiqada — Eng osoni)
1. [Netlify.com](https://www.netlify.com) saytiga kiring va profilingizga kiring.
2. **"Sites"** bo'limiga o'ting.
3. Ushbu `netlify web` papkasini sichqoncha bilan ushlab, Netlify oynasidagi **"Drag and drop your site output folder here"** maydoniga tashlang.
4. 10 soniyada sizga bepul `https://sizning-saytingiz.netlify.app` havolasi taqdim etiladi!

### 2-USUL: GitHub orqali
1. Ushbu papkani GitHub repozitoriyingizga push qiling.
2. Netlify-da **"Add new site" > "Import an existing project" > GitHub** ni tanlang.
3. Repozitoriyingizni tanlang va **"Deploy Site"** tugmasini bosing.
