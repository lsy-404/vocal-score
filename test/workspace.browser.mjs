export async function openSection(page,section){
  if(page.viewportSize()?.width<=700&&!await page.locator('.workspace').evaluate(node=>node.classList.contains('sidebar-open')))await page.locator('#sidebar-mobile-toggle').click();
  await page.locator(`.sidebar-nav-item[data-section="${section}"]`).click();
}
