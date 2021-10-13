describe('Products gallery page should display items', () => {
  it('product gallery displays six items', () => {
    cy.visit("http://localhost:5000/products")
    cy.get('main > div.product-list > div').should('have.length', 6)
  });

  // product 1
  it('product 1 should have the right details', () => {
    cy.get('div.product-list > div:nth-child(1) > h4').contains('Italian House Blend')  // Description
    cy.get('div.product-list > div:nth-child(1) > p').contains('$18')  // Price
    cy.get('div.product-list > div:nth-child(1) > div.image').should('have.css','background-image', 'url("http://localhost:5000/images/1.png")' )  // Image
    cy.get('div.product-list > div:nth-child(1) > div.cta > button').contains('Add to cart')  // Add to cart button text
    cy.get('div.product-list > div:nth-child(1) > h4 > a').should('have.attr', 'href').and('include', '/product/1') // Italian House Blend
  })  
});

describe('Product page should display correct information', () => {
  it('product page should have the right details', () => {
    cy.visit("http://localhost:5000/products")
    cy.get('div.product-list > div:nth-child(1) > h4 > a').click()
    cy.wait(5000)      

    cy.get('#productdetails > div:nth-child(2) > p:nth-child(1)').contains("Italian House Blend") // SKU
    cy.get('#productdetails > div:nth-child(2) > p:nth-child(2)').contains("SKU: 1") // Product name
    cy.get('#productdetails > div:nth-child(2) > h2').contains("$18") // Price
    cy.get('#productdetails > div:nth-child(2) > p:nth-child(3)').contains("Lorem ipsum dolor sit amet") // Description 
  });
});

describe("Clicking add to cart adds correct number of items to basket", () => {
  it('Cart should display X items when requested', () => {
    cy.visit("http://localhost:5000/products")
    cy.get('div.product-list > div:nth-child(1) > h4 > a').click()
    cy.wait(5000)
    
    cy.get("button").click()
    cy.wait(5000)
    cy.get(".basketcount").contains("1 items: $18")


    cy.get("body > main > section > a").click()
    cy.wait(2000)
    cy.get("div.basketcount").contains("1 items: $18")
  });
})

describe('clicking add to cart on two products shows correct number in basket', () => {
  it('adding to basket shows 2 items in basket', () => {
    cy.visit("http://localhost:5000/products")
    
    cy.get("div.product-list > div:nth-child(1) > div.cta > button").click()
    cy.get("div.product-list > div:nth-child(2) > div.cta > button").click()
    cy.get("div.cart-list > div.cart-item").should('have.length', 2);
  })
}) 