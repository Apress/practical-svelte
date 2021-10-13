describe('Testing Svelte website content pages', () => {
  it('Coffee page has correct content', () => {
    cy.visit("http://localhost:5000/coffee");

    cy.get('#banner > img').should('have.length', 1);  // banner image
    cy.get('h2').should('have.length', 1);
    cy.get('h2').contains('Our Coffee');  // title exists, and has correct text
  })

  it('About page has correct content', () => {
    cy.visit("http://localhost:5000/about");

    cy.get('#banner > img').should('have.length', 1);  // banner image
    cy.get('h2').should('have.length', 1);
    cy.get('h2').contains('About Us');  // title exists, and has correct text
  })  

  it('can submit form from contact us page', () => {
    cy.visit("http://localhost:5000/contact");

    cy.get('#banner > img').should('have.length', 1);  // banner image
    cy.get('h2').should('have.length', 1);
    cy.get('h2').contains('Contact Us');  // title exists, and has correct text    

    cy.get("form > span:nth-child(2) > input").type("Joe Customer") // Name
    cy.get("form > span:nth-child(4) > input").type("joe.customer@example.com") // Email
    cy.get("form > textarea").type("This is a test message") // Message
    cy.get("button").click()
    cy.on('window:alert', (txt) => {
      //Mocha assertions
      expect(txt).to.contains('Everything is validated!');
   })    
  }) 
})