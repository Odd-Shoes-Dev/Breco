export interface CompanyDocumentSettings {
  name?: string | null;
  legal_name?: string | null;
  ein?: string | null;
  duns_number?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

function escapeHtml(text: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (character) => entities[character]);
}

function value(text?: string | null): string {
  return text?.trim() ? escapeHtml(text.trim()) : '';
}

export function getCompanyDisplayName(settings?: CompanyDocumentSettings): string {
  return value(settings?.name) || value(settings?.legal_name);
}

function getAddressLines(settings?: CompanyDocumentSettings): string[] {
  const street = [value(settings?.address_line1), value(settings?.address_line2)]
    .filter(Boolean)
    .join(', ');
  const locality = [
    value(settings?.city),
    value(settings?.state),
    value(settings?.zip_code),
    value(settings?.country),
  ]
    .filter(Boolean)
    .join(', ');

  return [street, locality].filter(Boolean);
}

function getRegistrationLine(settings?: CompanyDocumentSettings): string {
  const ein = value(settings?.ein);
  const duns = value(settings?.duns_number);

  return [
    ein ? `URA TIN: ${ein}` : '',
    'URSB Reg. No: 80020001634842',
    duns ? `DUNS: ${duns}` : '',
  ]
    .filter(Boolean)
    .join(' • ');
}

export function renderCompanyHeaderDetails(settings?: CompanyDocumentSettings): string {
  const details = [
    ...getAddressLines(settings),
    settings?.phone ? `Tel: ${value(settings.phone)}` : '',
    settings?.email ? `Email: ${value(settings.email)}` : '',
    settings?.website ? `Website: ${value(settings.website)}` : '',
    getRegistrationLine(settings),
  ].filter(Boolean);

  return `<h1 class="company-name">${getCompanyDisplayName(settings)}</h1>
    <div class="company-details">
      ${details.map((detail) => `<p class="address">${detail}</p>`).join('\n      ')}
    </div>`;
}

export function renderCompanyContactLine(
  settings?: CompanyDocumentSettings,
  className = 'address'
): string {
  const contact = [
    settings?.phone ? `Tel: ${value(settings.phone)}` : '',
    settings?.email ? `Email: ${value(settings.email)}` : '',
    value(settings?.website),
  ]
    .filter(Boolean)
    .join(' • ');

  return contact ? `<div class="${escapeHtml(className)}">${contact}</div>` : '';
}

export function renderCompanySenderDetails(settings?: CompanyDocumentSettings): string {
  const details = [
    ...getAddressLines(settings),
    settings?.phone ? `Tel: ${value(settings.phone)}` : '',
    settings?.email ? `Email: ${value(settings.email)}` : '',
    settings?.website ? `Website: ${value(settings.website)}` : '',
  ].filter(Boolean);

  return `<p><strong>${getCompanyDisplayName(settings)}</strong></p>
    ${details.map((detail) => `<p>${detail}</p>`).join('\n    ')}`;
}

export function renderCompanyFooterDetails(settings?: CompanyDocumentSettings): string {
  const nameAndAddress = [getCompanyDisplayName(settings), ...getAddressLines(settings)]
    .filter(Boolean)
    .join(' • ');
  const contact = [
    settings?.phone ? `Tel: ${value(settings.phone)}` : '',
    settings?.email ? `Email: ${value(settings.email)}` : '',
    value(settings?.website),
  ]
    .filter(Boolean)
    .join(' • ');
  const registration = getRegistrationLine(settings);

  return [nameAndAddress, contact, registration]
    .filter(Boolean)
    .map((detail, index) => `<p${index === 0 ? ' style="margin-top: 8px;"' : ''}>${detail}</p>`)
    .join('\n          ');
}