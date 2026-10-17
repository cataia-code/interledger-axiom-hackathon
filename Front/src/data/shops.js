// Mock fixtures. Consumed only by the mock repository, never directly by screens.
export const shops = [
  {
    "id": "coffee",
    "name": "Café Ancestral",
    "category": "Gastronomía",
    "categoryIcon": "food",
    "type": "Café de origen",
    "rating": 4.8,
    "reviews": 120,
    "distance": "0.3 km",
    "price": 16000,
    "offer": "10% de descuento",
    "logo": "/assets/shops/coffee-logo.svg",
    "cover": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=85",
    "area": "Laureles, Medellín",
    "lat": 6.2444,
    "lng": -75.5941,
    "description": "Café de origen cultivado en las montañas de Antioquia. Una taza tranquila, tostada localmente y preparada con mucho cuidado.",
    "products": [
      {
        "id": "coffee-0",
        "name": "Café de origen · 250 g",
        "price": 32000,
        "image": "/assets/shops/coffee-product.svg",
        "photo": "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=640&q=85"
      },
      {
        "id": "coffee-1",
        "name": "Filtrado de la casa",
        "price": 12000,
        "image": "/assets/shops/coffee-product.svg",
        "photo": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=85"
      },
      {
        "id": "coffee-2",
        "name": "Pan de yuca",
        "price": 8000,
        "image": "/assets/shops/coffee-product.svg",
        "photo": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=640&q=85"
      }
    ]
  },
  {
    "id": "craft",
    "name": "Artesanías Bacatá",
    "category": "Artesanías",
    "categoryIcon": "craft",
    "type": "Hecho a mano",
    "rating": 4.9,
    "reviews": 85,
    "distance": "0.5 km",
    "price": 48000,
    "offer": "15% de descuento",
    "logo": "/assets/shops/craft-logo.svg",
    "cover": "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?auto=format&fit=crop&w=1200&q=85",
    "area": "San Javier · Comuna 13",
    "lat": 6.2528,
    "lng": -75.6172,
    "description": "Objetos tejidos y piezas de cerámica creados por artistas locales. Cada compra acompaña talleres y oficios del barrio.",
    "products": [
      {
        "id": "craft-0",
        "name": "Cuenco de barro",
        "price": 85000,
        "image": "/assets/shops/craft-product.svg",
        "photo": "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?auto=format&fit=crop&w=1200&q=85"
      },
      {
        "id": "craft-1",
        "name": "Collar artesanal",
        "price": 60000,
        "image": "/assets/shops/craft-product.svg",
        "photo": "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=640&q=85"
      },
      {
        "id": "craft-2",
        "name": "Jarrón artesanal",
        "price": 45000,
        "image": "/assets/shops/craft-product.svg",
        "photo": "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=640&q=85"
      }
    ]
  },
  {
    "id": "food",
    "name": "Sabores de la Tierra",
    "category": "Gastronomía",
    "categoryIcon": "food",
    "type": "Cocina antioqueña",
    "rating": 4.7,
    "reviews": 64,
    "distance": "0.7 km",
    "price": 25000,
    "offer": "2x1 en bebidas",
    "logo": "/assets/shops/food-logo.svg",
    "cover": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=85",
    "area": "La Candelaria · Centro",
    "lat": 6.2508,
    "lng": -75.5661,
    "description": "Cocina casera inspirada en ingredientes de las montañas antioqueñas y recetas que pasan de generación en generación.",
    "products": [
      {
        "id": "food-0",
        "name": "Menú del día",
        "price": 28000,
        "image": "/assets/shops/food-product.svg",
        "photo": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=85"
      },
      {
        "id": "food-1",
        "name": "Arepa de chócolo",
        "price": 14000,
        "image": "/assets/shops/food-product.svg",
        "photo": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=85"
      },
      {
        "id": "food-2",
        "name": "Chocolate de la casa",
        "price": 9000,
        "image": "/assets/shops/food-product.svg",
        "photo": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=85"
      }
    ]
  },
  {
    "id": "roots",
    "name": "Raíces de Antioquia",
    "category": "Moda",
    "categoryIcon": "bag",
    "type": "Diseño local",
    "rating": 4.8,
    "reviews": 52,
    "distance": "1.1 km",
    "price": 89000,
    "offer": "Envío gratis",
    "logo": "/assets/shops/roots-logo.svg",
    "cover": "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=85",
    "area": "El Poblado · Provenza",
    "lat": 6.2087,
    "lng": -75.5671,
    "description": "Moda y accesorios hechos en pequeños talleres de Medellín con materiales recuperados y técnicas artesanales.",
    "products": [
      {
        "id": "roots-0",
        "name": "Bolso tejido",
        "price": 145000,
        "image": "/assets/shops/roots-product.svg",
        "photo": "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=85"
      },
      {
        "id": "roots-1",
        "name": "Pañoleta ilustrada",
        "price": 68000,
        "image": "/assets/shops/roots-product.svg",
        "photo": "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=85"
      },
      {
        "id": "roots-2",
        "name": "Aretes de autor",
        "price": 52000,
        "image": "/assets/shops/roots-product.svg",
        "photo": "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=85"
      }
    ]
  },
  {
    "id": "mural",
    "name": "Ruta Graffiti 13",
    "category": "Experiencias",
    "categoryIcon": "culture",
    "type": "Cultura viva",
    "rating": 5,
    "reviews": 98,
    "distance": "2.4 km",
    "price": 42000,
    "offer": "$ 8 USD de descuento",
    "logo": "/assets/shops/mural-logo.svg",
    "cover": "/assets/medellin-mural.png",
    "area": "San Javier · Comuna 13",
    "lat": 6.2538,
    "lng": -75.6225,
    "description": "Descubre los murales, las escaleras eléctricas y las historias de transformación junto a guías que viven en la Comuna 13.",
    "products": [
      {
        "id": "mural-0",
        "name": "Recorrido de graffiti",
        "price": 168000,
        "image": "/assets/shops/mural-product.svg",
        "photo": "/assets/medellin-mural.png"
      },
      {
        "id": "mural-1",
        "name": "Tour con guía local",
        "price": 112000,
        "image": "/assets/shops/mural-product.svg",
        "photo": "/assets/medellin-mural.png"
      }
    ]
  },
  {
    "id": "honey",
    "name": "Miel & Montaña",
    "category": "Artesanías",
    "categoryIcon": "craft",
    "type": "Productos locales",
    "rating": 4.8,
    "reviews": 41,
    "distance": "3.2 km",
    "price": 24000,
    "offer": "12% de descuento",
    "logo": "/assets/shops/honey-logo.svg",
    "cover": "https://images.unsplash.com/photo-1587049352851-8d4e89133924?auto=format&fit=crop&w=1200&q=85",
    "area": "Envigado · Valle de Aburrá",
    "lat": 6.1707,
    "lng": -75.5853,
    "description": "Miel de montaña, conservas y productos de fincas familiares seleccionados directamente con productores de Antioquia.",
    "products": [
      {
        "id": "honey-0",
        "name": "Miel de abejas · 350 g",
        "price": 38000,
        "image": "/assets/shops/honey-product.svg",
        "photo": "https://images.unsplash.com/photo-1587049352851-8d4e89133924?auto=format&fit=crop&w=1200&q=85"
      },
      {
        "id": "honey-1",
        "name": "Mermelada de mora",
        "price": 24000,
        "image": "/assets/shops/honey-product.svg",
        "photo": "https://images.unsplash.com/photo-1587049352851-8d4e89133924?auto=format&fit=crop&w=1200&q=85"
      }
    ]
  }
];
