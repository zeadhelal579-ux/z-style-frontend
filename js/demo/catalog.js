// English header: The storefront's built-in catalog for standalone (no-backend) mode - 8
// categories x 10 products, each with 3 colour variants, a size/stock table and a few promo
// items. It mirrors what DbSeeder.cs puts into the real database (same category slugs, same
// colour palette, every 4th product on promo, same gender rule), but with realistic product
// names and size scales, and it is generated from a fixed random seed so the catalog is
// identical on every visit. Images are short "art:" URLs resolved by productArt.js.
// Edit the CATEGORY_DEFS table below to rename, add or remove products - nothing else needs
// to change.

const BASE_DATE = Date.parse('2026-09-01T09:00:00Z');
const DAY_MS = 86400000;

// How many of the 5 palette colours each product offers (the real seeder uses 3).
const COLORS_PER_PRODUCT = 3;

const COLOR_PALETTE = [
    { color: 'Black', hex: '#1a1a1a' },
    { color: 'Clay', hex: '#b56a4e' },
    { color: 'Sand', hex: '#d9c4a3' },
    { color: 'Olive', hex: '#6b7052' },
    { color: 'Ivory', hex: '#f2e7dc' }
];

const CLOTHING_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const SHOE_SIZES = ['39', '40', '41', '42', '43', '44', '45'];
const ONE_SIZE = ['One Size'];

// Each product row: [name, art style used by productArt.js, short description].
const CATEGORY_DEFS = [
    {
        name: 'Pants', slug: 'pants', gender: 'Unisex', shape: 'pants', sizes: CLOTHING_SIZES, price: [650, 1400],
        products: [
            ['Classic Straight Jeans', 'jeans', 'Rigid cotton denim with a clean straight leg and a mid-rise waist.'],
            ['Utility Cargo Pants', 'cargo', 'Relaxed cotton twill with roomy side pockets built for everyday carry.'],
            ['Wide-Leg Trousers', 'wide', 'A fluid wide-leg cut with a high waist that drapes beautifully.'],
            ['Slim Fit Chinos', 'chino', 'Soft stretch chino with a tapered leg that works from desk to dinner.'],
            ['Essential Joggers', 'jogger', 'Brushed fleece joggers with ribbed cuffs and a drawcord waist.'],
            ['Pleated Tailored Trousers', 'trouser', 'A sharp pressed crease and a smooth finish for a polished look.'],
            ['Relaxed Tapered Jeans', 'jeans', 'A roomier thigh that tapers down for an easy, lived-in fit.'],
            ['Parachute Cargo Pants', 'cargo', 'Lightweight woven fabric with utility pockets and a loose silhouette.'],
            ['Heavyweight Sweatpants', 'jogger', 'Dense cotton fleece that holds its shape wash after wash.'],
            ['Linen Wide Pants', 'wide', 'A breathable linen blend cut wide for warm days.']
        ]
    },
    {
        name: 'T-Shirts', slug: 't-shirts', gender: 'Unisex', shape: 'tee', sizes: CLOTHING_SIZES, price: [250, 600],
        products: [
            ['Essential Crew Tee', 'crew', 'Midweight cotton jersey with a classic crew neck and a soft hand-feel.'],
            ['V-Neck Everyday Tee', 'vneck', 'A slim V-neck that layers easily under shirts and jackets.'],
            ['Pocket Tee', 'pocket', 'A straight-cut cotton tee with a single chest pocket.'],
            ['Boxy Heavyweight Tee', 'boxy', 'Thick, structured cotton in a boxy cut with dropped shoulders.'],
            ['Cropped Baby Tee', 'cropped', 'Soft ribbed cotton in a short, fitted cut.'],
            ['Long Sleeve Tee', 'long', 'Smooth cotton jersey with full-length sleeves for cooler days.'],
            ['Oversized Crew Tee', 'boxy', 'Relaxed through the body with extra room in the sleeves.'],
            ['Slim Fit V-Neck', 'vneck', 'Close-fitting jersey with a deep V and a clean hem.'],
            ['Garment-Dyed Pocket Tee', 'pocket', 'Washed for a worn-in colour and a lived-in feel from day one.'],
            ['Ribbed Long Sleeve Tee', 'long', 'Stretchy ribbed knit that hugs without feeling tight.']
        ]
    },
    {
        name: 'Hoodies', slug: 'hoodies', gender: 'Unisex', shape: 'hoodie', sizes: CLOTHING_SIZES, price: [750, 1500],
        products: [
            ['Classic Pullover Hoodie', 'pullover', 'Cozy brushed fleece with a roomy hood and a kangaroo pocket.'],
            ['Zip-Up Hoodie', 'zip', 'A full-length zip front with ribbed cuffs and hem.'],
            ['Oversized Fleece Hoodie', 'oversized', 'Dropped shoulders and a generous fit in heavy fleece.'],
            ['Cropped Hoodie', 'cropped', 'A shorter cut that pairs well with high-waisted bottoms.'],
            ['Heavyweight Hoodie', 'pullover', 'Extra-thick fleece for real warmth without feeling stiff.'],
            ['Track Zip Hoodie', 'zip', 'A sporty zip hoodie with a smooth outer face and a soft lining.'],
            ['Boxy Oversized Hoodie', 'oversized', 'A wide body, a short length and a structured hood.'],
            ['Soft Cropped Hoodie', 'cropped', 'A cropped silhouette in a soft cotton blend.'],
            ['Brushed Pullover Hoodie', 'pullover', 'Peached on the inside for an ultra-soft feel against the skin.'],
            ['Essential Zip Hoodie', 'zip', 'A wardrobe staple with a simple zip and clean lines.']
        ]
    },
    {
        name: 'Shirts', slug: 'shirts', gender: 'Men', shape: 'shirt', sizes: CLOTHING_SIZES, price: [500, 1100],
        products: [
            ['Oxford Button-Down Shirt', 'oxford', 'A classic oxford weave with a button-down collar and chest pocket.'],
            ['Mandarin Collar Shirt', 'mandarin', 'A clean band collar and a smooth poplin finish.'],
            ['Camp Collar Shirt', 'camp', 'Short sleeves and an open camp collar for warm-weather ease.'],
            ['Utility Work Shirt', 'work', 'Sturdy cotton with twin chest pockets and a straight hem.'],
            ['Linen Button-Up', 'oxford', 'Lightweight linen that stays cool and softens with every wash.'],
            ['Short Sleeve Resort Shirt', 'camp', 'A relaxed boxy fit made for holidays and long evenings.'],
            ['Band Collar Linen Shirt', 'mandarin', 'A collarless neckline in breathable linen.'],
            ['Double Pocket Overshirt', 'work', 'A heavier shirt that doubles as a light outer layer.'],
            ['Relaxed Oxford Shirt', 'oxford', 'A roomier cut in soft, washed oxford cotton.'],
            ['Easy Camp Shirt', 'camp', 'A drapey woven fabric with a relaxed straight hem.']
        ]
    },
    {
        name: 'Dresses', slug: 'dresses', gender: 'Women', shape: 'dress', sizes: CLOTHING_SIZES, price: [700, 1800],
        products: [
            ['Belted Midi Dress', 'belted', 'A defined waist with a full skirt that falls below the knee.'],
            ['Slip Dress', 'slip', 'A bias-cut feel with slim straps and a fluid skirt.'],
            ['Short Sleeve Flare Dress', 'sleeved', 'A fit-and-flare shape with little cap sleeves.'],
            ['Pleated Slip Dress', 'slip', 'Fine pleats in the skirt that move with every step.'],
            ['Wrap Belt Dress', 'belted', 'Cinched at the waist with an adjustable belt.'],
            ['Everyday Sleeved Dress', 'sleeved', 'Soft, breathable fabric for effortless daily wear.'],
            ['Satin Slip Dress', 'slip', 'A smooth satin-look finish with a subtle sheen.'],
            ['Belted Shirt Dress', 'belted', 'Relaxed shirt-dress proportions with a tie waist.'],
            ['Linen Sleeved Dress', 'sleeved', 'Breathable linen with a gently flared skirt.'],
            ['Evening Pleated Dress', 'belted', 'A dressier option with a fitted bodice and a pleated skirt.']
        ]
    },
    {
        name: 'Bags', slug: 'bags', gender: 'Unisex', shape: 'bag', sizes: ONE_SIZE, price: [600, 2200],
        products: [
            ['Canvas Tote Bag', 'tote', 'Sturdy canvas with long handles and an inner zip pocket.'],
            ['Leather Crossbody Bag', 'crossbody', 'A compact structured bag with an adjustable strap and flap closure.'],
            ['Everyday Backpack', 'backpack', 'Padded straps and a roomy main compartment.'],
            ['Market Tote', 'tote', 'A roomy open-top tote for groceries, books and everything else.'],
            ['Mini Crossbody', 'crossbody', 'Small enough for the essentials, polished enough for evenings.'],
            ['Commuter Backpack', 'backpack', 'Fits a laptop and keeps everything organised.'],
            ['Weekend Tote', 'tote', 'Extra depth for overnight trips and gym days.'],
            ['Structured Crossbody', 'crossbody', 'A boxy silhouette with gold-tone hardware.'],
            ['Roll-Top Backpack', 'backpack', 'A water-resistant feel with an expandable top.'],
            ['Slouch Tote', 'tote', 'A soft, unstructured body that moulds to your shoulder.']
        ]
    },
    {
        name: 'Accessories', slug: 'accessories', gender: 'Unisex', shape: 'accessory', sizes: ONE_SIZE, price: [150, 900],
        products: [
            ['Classic Baseball Cap', 'cap', 'A six-panel cotton cap with a curved brim and an adjustable fit.'],
            ['Square Frame Sunglasses', 'sunglasses', 'Bold square frames with dark UV-protective lenses.'],
            ['Round Frame Sunglasses', 'roundglasses', 'Retro round frames that suit almost every face.'],
            ['Leather Belt', 'belt', 'A full-grain finish with a gold-tone buckle.'],
            ['Ribbed Beanie', 'beanie', 'A stretchy rib knit with a deep, folded cuff.'],
            ['Minimal Round Watch', 'watch', 'A clean dial, a slim case and a soft leather strap.'],
            ['Square Dial Watch', 'squarewatch', 'A modern square case with a textured strap.'],
            ['Adjustable Dad Cap', 'cap', 'Washed cotton with an easy, slightly worn-in shape.'],
            ['Woven Belt', 'belt', 'A flexible woven style that goes with chinos and jeans.'],
            ['Cuff Beanie', 'beanie', 'A warm knit with a generous cuff for cold mornings.']
        ]
    },
    {
        name: 'Shoes', slug: 'shoes', gender: 'Unisex', shape: 'shoes', sizes: SHOE_SIZES, price: [900, 2600],
        products: [
            ['Low-Top Sneakers', 'sneaker', 'Clean leather-look uppers on a cushioned cupsole.'],
            ['Retro Runner', 'runner', 'A chunky midsole and breathable mesh for all-day comfort.'],
            ['High-Top Sneakers', 'hightop', 'A padded ankle collar and a grippy rubber outsole.'],
            ['Chelsea Boots', 'boot', 'Elastic side panels and a pull tab for easy on-and-off.'],
            ['Leather Loafers', 'loafer', 'A slip-on style with a smooth finish and a flexible sole.'],
            ['Court Sneakers', 'sneaker', 'A minimal court-inspired profile that goes with everything.'],
            ['Trail Runner', 'runner', 'An extra-grippy sole and a supportive fit for uneven ground.'],
            ['Canvas High-Tops', 'hightop', 'Lightweight canvas with a classic vulcanised sole.'],
            ['Suede Chelsea Boots', 'boot', 'A soft suede-look finish with a stacked heel.'],
            ['Penny Loafers', 'loafer', 'A timeless low-profile loafer for smart-casual outfits.']
        ]
    }
];

// Small deterministic PRNG (mulberry32) so the catalog never changes between visits.
function createRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Rounds to a shop-style price ending in 99 (>= 500) or 49 (below 500), e.g. 699, 1299, 349.
function shopPrice(raw) {
    return raw >= 500 ? Math.round(raw / 100) * 100 - 1 : Math.round(raw / 50) * 50 - 1;
}

// Same gender rule as DbSeeder.cs: unisex categories mix Men / Women / Unisex items,
// single-gender categories (Shirts = Men, Dresses = Women) keep their own gender.
function genderFor(categoryGender, indexInCategory) {
    if (categoryGender !== 'Unisex') return categoryGender;
    if (indexInCategory % 3 === 0) return 'Unisex';
    return indexInCategory % 2 === 0 ? 'Men' : 'Women';
}

// Builds the size/stock table. Roughly 1 in 8 sizes is sold out, but every product keeps at
// least three sizes in stock so the "Add to Bag" flow can always be demonstrated.
function buildSizes(sizeLabels, random) {
    if (sizeLabels === ONE_SIZE) {
        return [{ size: 'One Size', stockQuantity: 5 + Math.floor(random() * 36) }];
    }
    const sizes = sizeLabels.map(size => ({
        size,
        stockQuantity: random() < 0.12 ? 0 : 1 + Math.floor(random() * 39)
    }));
    let guard = 0;
    while (sizes.filter(s => s.stockQuantity > 0).length < 3 && guard++ < 20) {
        const empty = sizes.find(s => s.stockQuantity === 0);
        if (empty) empty.stockQuantity = 3 + Math.floor(random() * 20);
    }
    return sizes;
}

// Picks COLORS_PER_PRODUCT distinct palette colours with a seeded shuffle.
function pickColors(random) {
    const pool = [...COLOR_PALETTE];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, COLORS_PER_PRODUCT);
}

// The photos of one colour variant (first = main photo, the rest appear as thumbnails).
// By default they are drawn by productArt.js. To use your own photos, drop the files into
// assets/products/ and return their paths here instead, for example:
//   return [`assets/products/${slug}-${color.toLowerCase()}-1.jpg`, `assets/products/${slug}-${color.toLowerCase()}-2.jpg`];
function imagesFor({ shape, artStyle, hex }) {
    const art = `${shape}/${artStyle}/${hex.slice(1)}`;
    return [`art:product/${art}/front`, `art:product/${art}/detail`];
}

// Assembles categories and products. Ids are assigned in insertion order, exactly like the
// database identity columns would be (categories 1-8, products 1-80, variants 1-240).
function buildCatalog() {
    const random = createRandom(42);
    const categories = [];
    const products = [];
    let productId = 0;
    let variantId = 0;

    CATEGORY_DEFS.forEach((def, categoryIndex) => {
        const category = {
            id: categoryIndex + 1,
            name: def.name,
            slug: def.slug,
            iconUrl: `art:icon/${def.slug}`,
            displayOrder: categoryIndex
        };
        categories.push(category);

        def.products.forEach(([name, artStyle, description], i) => {
            const number = i + 1;
            const basePrice = shopPrice(def.price[0] + random() * (def.price[1] - def.price[0]));
            const isPromo = number % 4 === 0;

            const variants = pickColors(random).map(({ color, hex }) => {
                variantId += 1;
                return {
                    id: variantId,
                    color,
                    colorHex: hex,
                    images: imagesFor({ shape: def.shape, artStyle, hex })
                };
            });

            productId += 1;
            products.push({
                id: productId,
                categoryId: category.id,
                name,
                description,
                basePrice,
                isPromo,
                promoPrice: isPromo ? Math.round((basePrice * 0.8) / 10) * 10 - 1 : null,
                gender: genderFor(def.gender, number),
                createdAt: BASE_DATE - Math.floor(random() * 60) * DAY_MS,
                variants,
                sizes: buildSizes(def.sizes, random)
            });
        });
    });

    return { categories, products };
}

export const { categories: CATEGORIES, products: PRODUCTS } = buildCatalog();
