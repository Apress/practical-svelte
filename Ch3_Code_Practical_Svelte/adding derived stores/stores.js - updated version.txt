import { readable, writable, derived } from "svelte/store";

let products = readable([{
    id: 1,
    name: "Italian House Blend",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ac tellus finibus, molestie purus id, placerat augue. Sed in arcu placerat, ultricies nibh et, auctor dolor.",
    image: "/images/1.png",
    large_image: "/images/1_large.png",
    price: 18,
    quantity: 1
  },
  {
    id: 2,
    name: "Cuban Altura Lavado",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ac tellus finibus, molestie purus id, placerat augue. Sed in arcu placerat, ultricies nibh et, auctor dolor.",
    image: "/images/2.png",
    large_image: "/images/2_large.png",
    price: 18,
    quantity: 1
  },
  {
    id: 3,
    name: "Indian Monsoon",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ac tellus finibus, molestie purus id, placerat augue. Sed in arcu placerat, ultricies nibh et, auctor dolor.",
    image: "/images/3.png",
    large_image: "/images/3_large.png",
    price: 18,
    quantity: 1
  },
  {
    id: 4,
    name: "Robusta Uganda",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ac tellus finibus, molestie purus id, placerat augue. Sed in arcu placerat, ultricies nibh et, auctor dolor.",
    image: "/images/4.png",
    large_image: "/images/4_large.png",
    price: 18,
    quantity: 1
  },
  {
    id: 5,
    name: "Yemen Matari",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ac tellus finibus, molestie purus id, placerat augue. Sed in arcu placerat, ultricies nibh et, auctor dolor.",
    image: "/images/5.png",
    large_image: "/images/5_large.png",
    price: 18,
    quantity: 1
  },
  {
    id: 6,
    name: "Salvador Pacamara",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ac tellus finibus, molestie purus id, placerat augue. Sed in arcu placerat, ultricies nibh et, auctor dolor.",
    image: "/images/6.png",
    large_image: "/images/6_large.png",
    price: 18,
    quantity: 1
  }
]);

let cart = writable([])
let totalprice = derived(
  cart,
  ($cart) => {
    let price = 0
    $cart.forEach(e => price = price + e.price)
    return price
  }
);


export { cart, products, totalprice }