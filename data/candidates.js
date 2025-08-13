export const districts = {
  'Tanah Abang': ['Siti Sofwati', 'Suherno', 'Luli Huriah'],
  'Menteng': ['Lisnawati', 'Ratwi', 'Roberto'],
  'Senen': ['Puji Lestari', 'Rina Rulina', 'Annisa Eka Aulia'],
  'Johar Baru': ['Umi Nadiroh', 'Yuliani zaizah', 'dewi damayanti'],
  'Cempaka Putih': ['Murni Asih', 'Caesar agni', 'fitri mulyant'],
  'Kemayoran': ['naufal', 'meita yosnita', 'rizalina'],
  'Sawah besar': ['nilam sarwani simbolon', 'tasya khafifah', 'M Ajid'],
  'Gambir': ['Siti Ramayanti', 'Padame Siahaan', 'Corina']
};

export const aspects = [
  { name: 'Kejujuran', weight: 15 },
  { name: 'Loyalitas', weight: 15 },
  { name: 'Penyelesaian pekerjaan', weight: 15 },
  { name: 'Kualitas pekerjaan', weight: 15 },
  { name: 'Kerjasama', weight: 10 },
  { name: 'Pengembangan diri', weight: 10 },
  { name: 'Komunikasi', weight: 10 },
  { name: 'Percaya diri', weight: 10 }
];

export const getAllCandidates = () => {
  const candidates = [];
  Object.entries(districts).forEach(([district, names]) => {
    names.forEach(name => {
      candidates.push({ name, district });
    });
  });
  return candidates;
};