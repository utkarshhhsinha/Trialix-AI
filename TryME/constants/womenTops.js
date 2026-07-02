/**
 * Women's Tops catalog — 19 items
 *
 * - image: local require() for in-app display
 * - buyLink: product purchase URL
 * - imageUrl: public URL used by the AI try-on cloud function (Unsplash fallback
 *   until the local images are uploaded to Firebase Storage)
 *
 * Image files present: top1–top11, top13–top19 (top12 is missing in assets).
 * top1–top11 map to links 1–11; top13–top19 map to links 12–18; 1sttop.jpg = link 19.
 */

export const WOMEN_TOPS = [
  {
    id: 'wt1',
    title: 'Green Floral Peplum Top',
    brand: 'Rain & Rainbow',
    priceINR: '699',
    category: 'upper_body',
    gender: 'female',
    image: require('@/Clothes/Women/Tops/top1.png'),
    tryOnImage: require('@/Clothes/Women/Tops/tryon_top1.png'),
    tryOnImageUrl: 'https://aura-ai-powered-fashion-aura.web.app/clothes/women/tryon_top1.png',
    buyLink:
      'https://rainandrainbow.com/products/green-floral-printed-sleeveless-peplum-pure-cotton-top?variant=50380853510447&country=IN&currency=INR',
    imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
  },
  {
    id: 'wt2',
    title: 'Purple Dress',
    brand: 'Tokyo Talkies',
    priceINR: '999',
    category: 'dresses',
    gender: 'female',
    image: require('@/Clothes/Women/Tops/top2.png'),
    tryOnImage: require('@/Clothes/Women/Tops/tryon_top2.png'),
    tryOnImageUrl: 'https://aura-ai-powered-fashion-aura.web.app/clothes/women/tryon_purple_dress.png',
    buyLink:
      'https://www.limeroad.com/purple-dress-tokyo-talkies-p22470795?imgIdx=0&src_id=merge_feed_story__3&reference_story_id=69f9cac2c95a470722a438c1',
    imageUrl: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&q=80',
  },
  {
    id: 'wt3',
    title: 'Marham Bell Sleeves Kurti',
    brand: 'Evara',
    priceINR: '1,299',
    category: 'upper_body',
    gender: 'female',
    image: require('@/Clothes/Women/Tops/top3.png'),
    tryOnImage: require('@/Clothes/Women/Tops/tryon_top3.png'),
    tryOnImageUrl: 'https://aura-ai-powered-fashion-aura.web.app/clothes/women/tryon_top3.png',
    buyLink:
      'https://evara.me/products/marham-bell-sleeves-kurti?variant=46413089046699&country=IN&currency=INR',
    imageUrl: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&q=80',
  },
  {
    id: 'wt4',
    title: 'Pastel Pink Chikankari Kurta',
    brand: 'Shanaya',
    priceINR: '1,499',
    category: 'upper_body',
    gender: 'female',
    image: require('@/Clothes/Women/Tops/top4.png'),
    tryOnImage: require('@/Clothes/Women/Tops/tryon_top4.png'),
    tryOnImageUrl: 'https://aura-ai-powered-fashion-aura.web.app/clothes/women/tryon_pink_kurta.png',
    buyLink:
      'https://shanaya.in/Pastel-Pink-Georgette-Chikankari-Embroidery-Kurta-With-Pant--/catalogue/e0jmeHw3/BEwXaj2Y',
    imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4d29?w=600&q=80',
  },
  {
    id: 'wt5',
    title: 'Cream Floral Kurta Set',
    brand: 'Vastrakaala',
    priceINR: '1,899',
    category: 'upper_body',
    gender: 'female',
    image: require('@/Clothes/Women/Tops/top5.png'),
    tryOnImage: require('@/Clothes/Women/Tops/tryon_top5.png'),
    tryOnImageUrl: 'https://aura-ai-powered-fashion-aura.web.app/clothes/women/tryon_top5.png',
    buyLink:
      'https://vastrakaala.com/products/cream-floral-printed-kurta-set-with-matching-dupatta-copy?currency=INR&country=IN&variant=51707841675583',
    imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80',
  },
  {
    id: 'wt6',
    title: 'Green Floral Empire Top',
    brand: 'Rain & Rainbow',
    priceINR: '599',
    category: 'upper_body',
    gender: 'female',
    image: require('@/Clothes/Women/Tops/top6.png'),
    tryOnImage: require('@/Clothes/Women/Tops/tryon_top6.png'),
    tryOnImageUrl: 'https://aura-ai-powered-fashion-aura.web.app/clothes/women/tryon_top6.png',
    buyLink:
      'https://rainandrainbow.com/products/women-green-floral-printed-pure-cotton-empire-tops?variant=49987890512175&country=IN&currency=INR',
    imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&q=80',
  },
  {
    id: 'wt7',
    title: 'Poshak Mal White Kurta Set',
    brand: 'Bullion Knot',
    priceINR: '2,199',
    category: 'upper_body',
    gender: 'female',
    image: require('@/Clothes/Women/Tops/top7.png'),
    tryOnImage: require('@/Clothes/Women/Tops/tryon_top7.png'),
    tryOnImageUrl: 'https://aura-ai-powered-fashion-aura.web.app/clothes/women/tryon_top7.png',
    buyLink:
      'https://www.bullionknot.com/products/poshak-mal-cotton-white-kurta-set?variant=44980776698032&country=IN&currency=INR',
    imageUrl: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&q=80',
  },
  {
    id: 'wt8',
    title: 'Grace in Ivory Kurti Set',
    brand: 'Jaipur Kurta',
    priceINR: '2,499',
    category: 'upper_body',
    gender: 'female',
    image: require('@/Clothes/Women/Tops/top8.png'),
    tryOnImage: require('@/Clothes/Women/Tops/tryon_top8.png'),
    tryOnImageUrl: 'https://aura-ai-powered-fashion-aura.web.app/clothes/women/tryon_ivory_kurti.png',
    buyLink:
      'https://jaipurkurta.com/products/grace-in-ivory-minimalist-elegance-kurti-set?variant=43579451048029&country=IN&currency=INR',
    imageUrl: 'https://images.unsplash.com/photo-1574164904299-3a102b110380?w=600&q=80',
  },
  {
    id: 'wt9',
    title: 'Grace in Ivory Minimalist Kurti',
    brand: 'Jaipur Kurta',
    priceINR: '2,499',
    category: 'upper_body',
    gender: 'female',
    image: require('@/Clothes/Women/Tops/top9.png'),
    tryOnImage: require('@/Clothes/Women/Tops/tryon_top9.png'),
    tryOnImageUrl: 'https://aura-ai-powered-fashion-aura.web.app/clothes/women/tryon_ivory_kurti.png',
    buyLink:
      'https://jaipurkurta.com/products/grace-in-ivory-minimalist-elegance-kurti-set?variant=43579451048029&country=IN&currency=INR',
    imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&q=80',
  },
  {
    id: 'wt10',
    title: 'Animal Print Kurta with Palazzos',
    brand: 'Lookmark',
    priceINR: '1,599',
    category: 'upper_body',
    gender: 'female',
    image: require('@/Clothes/Women/Tops/top10.png'),
    buyLink:
      'https://www.myntra.com/kurta-sets/lookmark/lookmark-women-animal-printed-regular-a-line-calf-length-kurta-with-palazzos/34018371/buy',
    imageUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&q=80',
  },
  {
    id: 'wt11',
    title: 'Print Crop Top',
    brand: 'Moda Rapido',
    priceINR: '799',
    category: 'upper_body',
    gender: 'female',
    image: require('@/Clothes/Women/Tops/top11.png'),
    buyLink:
      'https://www.myntra.com/tops/moda+rapido/moda-rapido-print-crop-top/42428516/buy',
    imageUrl: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600&q=80',
  },
  {
    id: 'wt12',
    title: 'Bow Top',
    brand: 'Savana',
    priceINR: '1,099',
    category: 'upper_body',
    gender: 'female',
    // top12.png doesn't exist in assets; using top13.png as display image
    image: require('@/Clothes/Women/Tops/top13.png'),
    buyLink:
      'https://www.savana.com/details/bow-top-1781682?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=25&skcPGs=293870-393317',
    imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
  },
  {
    id: 'wt13',
    title: 'Placket Blouse',
    brand: 'Savana',
    priceINR: '999',
    category: 'upper_body',
    gender: 'female',
    image: require('@/Clothes/Women/Tops/top14.png'),
    buyLink:
      'https://www.savana.com/details/placket-blouse-2130912?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=2&skcPGs=350587-453870',
    imageUrl: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&q=80',
  },
  {
    id: 'wt14',
    title: 'Lace Trimmed Wrap Top',
    brand: 'Savana',
    priceINR: '1,199',
    category: 'upper_body',
    gender: 'female',
    image: require('@/Clothes/Women/Tops/top15.png'),
    buyLink:
      'https://www.savana.com/details/lace-trimmed-wrap-top-1987182?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=16&skcPGs=326547-433777',
    imageUrl: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&q=80',
  },
  {
    id: 'wt15',
    title: 'Asymmetric Top',
    brand: 'Savana',
    priceINR: '899',
    category: 'upper_body',
    gender: 'female',
    image: require('@/Clothes/Women/Tops/top16.png'),
    buyLink:
      'https://www.savana.com/details/asymmetric-top-1998762?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&skcPGs=328549-430305&vid=318',
    imageUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&q=80',
  },
  {
    id: 'wt16',
    title: 'Draped Top',
    brand: 'Savana',
    priceINR: '849',
    category: 'upper_body',
    gender: 'female',
    image: require('@/Clothes/Women/Tops/top17.png'),
    buyLink:
      'https://www.savana.com/details/draped-top-1602882?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=6&skcPGs=266174-413087',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80',
  },
  {
    id: 'wt17',
    title: 'Draped Top (Alt)',
    brand: 'Savana',
    priceINR: '849',
    category: 'upper_body',
    gender: 'female',
    image: require('@/Clothes/Women/Tops/top18.png'),
    buyLink:
      'https://www.savana.com/details/draped-top-1602882?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=6&skcPGs=266174-413087',
    imageUrl: 'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=600&q=80',
  },
  {
    id: 'wt18',
    title: 'Sequin Embroidered Tank Top',
    brand: 'Savana',
    priceINR: '1,499',
    category: 'upper_body',
    gender: 'female',
    image: require('@/Clothes/Women/Tops/top19.png'),
    buyLink:
      'https://www.savana.com/details/sequin-embroidered-tank-top-2096502?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&skcPGs=367590-470053&vid=1',
    imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80',
  },
  {
    id: 'wt19',
    title: 'Gathered Top',
    brand: 'Savana',
    priceINR: '949',
    category: 'upper_body',
    gender: 'female',
    // Using top1.png as asset fallback
    image: require('@/Clothes/Women/Tops/top1.png'),
    tryOnImage: require('@/Clothes/Women/Tops/tryon_top1.png'),
    tryOnImageUrl: 'https://aura-ai-powered-fashion-aura.web.app/clothes/women/tryon_top1.png',
    buyLink:
      'https://www.savana.com/details/gathered-top-1801422?utm_source=Free&utm_medium=ItemShare&utm_campaign=Whatsapp&ub_cl=in_en-IN&vid=3&skcPGs=307652-406989',
    imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=80',
  },
];
