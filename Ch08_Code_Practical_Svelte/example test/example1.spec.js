beforeEach(() => {
  cy.visit("https://svelte.dev");
})

describe('Testing Svelte website front page', () => {
  it('shows 3 boxes', () => {
    cy.get('.box').should('have.length', 3);
  })

  it('each box is of a different color', () => {
    cy.get('.box:nth-child(1)').should('have.css', 'background-color', 'rgb(255, 62, 0)')
    cy.get('.box:nth-child(2)').should('have.css', 'background-color', 'rgb(64, 179, 255)')
    cy.get('.box:nth-child(3)').should('have.css', 'background-color', 'rgb(103, 103, 120)')
  });
})
