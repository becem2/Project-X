export type PhoneCountryOption = {
  label: string;
  iso2: string;
  dialCode: string;
  flag: string;
  value: string;
};

const PHONE_COUNTRY_DATA: Array<{ label: string; iso2: string; dialCode: string }> = [
  { label: "Afghanistan", iso2: "AF", dialCode: "+93" },
  { label: "Albania", iso2: "AL", dialCode: "+355" },
  { label: "Algeria", iso2: "DZ", dialCode: "+213" },
  { label: "Andorra", iso2: "AD", dialCode: "+376" },
  { label: "Angola", iso2: "AO", dialCode: "+244" },
  { label: "Antigua and Barbuda", iso2: "AG", dialCode: "+1" },
  { label: "Argentina", iso2: "AR", dialCode: "+54" },
  { label: "Armenia", iso2: "AM", dialCode: "+374" },
  { label: "Australia", iso2: "AU", dialCode: "+61" },
  { label: "Austria", iso2: "AT", dialCode: "+43" },
  { label: "Azerbaijan", iso2: "AZ", dialCode: "+994" },
  { label: "Bahamas", iso2: "BS", dialCode: "+1" },
  { label: "Bahrain", iso2: "BH", dialCode: "+973" },
  { label: "Bangladesh", iso2: "BD", dialCode: "+880" },
  { label: "Barbados", iso2: "BB", dialCode: "+1" },
  { label: "Belarus", iso2: "BY", dialCode: "+375" },
  { label: "Belgium", iso2: "BE", dialCode: "+32" },
  { label: "Belize", iso2: "BZ", dialCode: "+501" },
  { label: "Benin", iso2: "BJ", dialCode: "+229" },
  { label: "Bhutan", iso2: "BT", dialCode: "+975" },
  { label: "Bolivia", iso2: "BO", dialCode: "+591" },
  { label: "Bosnia and Herzegovina", iso2: "BA", dialCode: "+387" },
  { label: "Botswana", iso2: "BW", dialCode: "+267" },
  { label: "Brazil", iso2: "BR", dialCode: "+55" },
  { label: "Brunei", iso2: "BN", dialCode: "+673" },
  { label: "Bulgaria", iso2: "BG", dialCode: "+359" },
  { label: "Burkina Faso", iso2: "BF", dialCode: "+226" },
  { label: "Burundi", iso2: "BI", dialCode: "+257" },
  { label: "Cabo Verde", iso2: "CV", dialCode: "+238" },
  { label: "Cambodia", iso2: "KH", dialCode: "+855" },
  { label: "Cameroon", iso2: "CM", dialCode: "+237" },
  { label: "Canada", iso2: "CA", dialCode: "+1" },
  { label: "Central African Republic", iso2: "CF", dialCode: "+236" },
  { label: "Chad", iso2: "TD", dialCode: "+235" },
  { label: "Chile", iso2: "CL", dialCode: "+56" },
  { label: "China", iso2: "CN", dialCode: "+86" },
  { label: "Colombia", iso2: "CO", dialCode: "+57" },
  { label: "Comoros", iso2: "KM", dialCode: "+269" },
  { label: "Congo", iso2: "CG", dialCode: "+242" },
  { label: "Costa Rica", iso2: "CR", dialCode: "+506" },
  { label: "Croatia", iso2: "HR", dialCode: "+385" },
  { label: "Cuba", iso2: "CU", dialCode: "+53" },
  { label: "Cyprus", iso2: "CY", dialCode: "+357" },
  { label: "Czechia", iso2: "CZ", dialCode: "+420" },
  { label: "Democratic Republic of the Congo", iso2: "CD", dialCode: "+243" },
  { label: "Denmark", iso2: "DK", dialCode: "+45" },
  { label: "Djibouti", iso2: "DJ", dialCode: "+253" },
  { label: "Dominica", iso2: "DM", dialCode: "+1" },
  { label: "Dominican Republic", iso2: "DO", dialCode: "+1" },
  { label: "Ecuador", iso2: "EC", dialCode: "+593" },
  { label: "Egypt", iso2: "EG", dialCode: "+20" },
  { label: "El Salvador", iso2: "SV", dialCode: "+503" },
  { label: "Equatorial Guinea", iso2: "GQ", dialCode: "+240" },
  { label: "Eritrea", iso2: "ER", dialCode: "+291" },
  { label: "Estonia", iso2: "EE", dialCode: "+372" },
  { label: "Eswatini", iso2: "SZ", dialCode: "+268" },
  { label: "Ethiopia", iso2: "ET", dialCode: "+251" },
  { label: "Fiji", iso2: "FJ", dialCode: "+679" },
  { label: "Finland", iso2: "FI", dialCode: "+358" },
  { label: "France", iso2: "FR", dialCode: "+33" },
  { label: "Gabon", iso2: "GA", dialCode: "+241" },
  { label: "Gambia", iso2: "GM", dialCode: "+220" },
  { label: "Georgia", iso2: "GE", dialCode: "+995" },
  { label: "Germany", iso2: "DE", dialCode: "+49" },
  { label: "Ghana", iso2: "GH", dialCode: "+233" },
  { label: "Greece", iso2: "GR", dialCode: "+30" },
  { label: "Grenada", iso2: "GD", dialCode: "+1" },
  { label: "Guatemala", iso2: "GT", dialCode: "+502" },
  { label: "Guinea", iso2: "GN", dialCode: "+224" },
  { label: "Guinea-Bissau", iso2: "GW", dialCode: "+245" },
  { label: "Guyana", iso2: "GY", dialCode: "+592" },
  { label: "Haiti", iso2: "HT", dialCode: "+509" },
  { label: "Honduras", iso2: "HN", dialCode: "+504" },
  { label: "Hungary", iso2: "HU", dialCode: "+36" },
  { label: "Iceland", iso2: "IS", dialCode: "+354" },
  { label: "India", iso2: "IN", dialCode: "+91" },
  { label: "Indonesia", iso2: "ID", dialCode: "+62" },
  { label: "Iran", iso2: "IR", dialCode: "+98" },
  { label: "Iraq", iso2: "IQ", dialCode: "+964" },
  { label: "Ireland", iso2: "IE", dialCode: "+353" },
  { label: "Israel", iso2: "IL", dialCode: "+972" },
  { label: "Italy", iso2: "IT", dialCode: "+39" },
  { label: "Jamaica", iso2: "JM", dialCode: "+1" },
  { label: "Japan", iso2: "JP", dialCode: "+81" },
  { label: "Jordan", iso2: "JO", dialCode: "+962" },
  { label: "Kazakhstan", iso2: "KZ", dialCode: "+7" },
  { label: "Kenya", iso2: "KE", dialCode: "+254" },
  { label: "Kiribati", iso2: "KI", dialCode: "+686" },
  { label: "Kuwait", iso2: "KW", dialCode: "+965" },
  { label: "Kyrgyzstan", iso2: "KG", dialCode: "+996" },
  { label: "Laos", iso2: "LA", dialCode: "+856" },
  { label: "Latvia", iso2: "LV", dialCode: "+371" },
  { label: "Lebanon", iso2: "LB", dialCode: "+961" },
  { label: "Lesotho", iso2: "LS", dialCode: "+266" },
  { label: "Liberia", iso2: "LR", dialCode: "+231" },
  { label: "Libya", iso2: "LY", dialCode: "+218" },
  { label: "Liechtenstein", iso2: "LI", dialCode: "+423" },
  { label: "Lithuania", iso2: "LT", dialCode: "+370" },
  { label: "Luxembourg", iso2: "LU", dialCode: "+352" },
  { label: "Madagascar", iso2: "MG", dialCode: "+261" },
  { label: "Malawi", iso2: "MW", dialCode: "+265" },
  { label: "Malaysia", iso2: "MY", dialCode: "+60" },
  { label: "Maldives", iso2: "MV", dialCode: "+960" },
  { label: "Mali", iso2: "ML", dialCode: "+223" },
  { label: "Malta", iso2: "MT", dialCode: "+356" },
  { label: "Marshall Islands", iso2: "MH", dialCode: "+692" },
  { label: "Mauritania", iso2: "MR", dialCode: "+222" },
  { label: "Mauritius", iso2: "MU", dialCode: "+230" },
  { label: "Mexico", iso2: "MX", dialCode: "+52" },
  { label: "Micronesia", iso2: "FM", dialCode: "+691" },
  { label: "Moldova", iso2: "MD", dialCode: "+373" },
  { label: "Monaco", iso2: "MC", dialCode: "+377" },
  { label: "Mongolia", iso2: "MN", dialCode: "+976" },
  { label: "Montenegro", iso2: "ME", dialCode: "+382" },
  { label: "Morocco", iso2: "MA", dialCode: "+212" },
  { label: "Mozambique", iso2: "MZ", dialCode: "+258" },
  { label: "Myanmar", iso2: "MM", dialCode: "+95" },
  { label: "Namibia", iso2: "NA", dialCode: "+264" },
  { label: "Nauru", iso2: "NR", dialCode: "+674" },
  { label: "Nepal", iso2: "NP", dialCode: "+977" },
  { label: "Netherlands", iso2: "NL", dialCode: "+31" },
  { label: "New Zealand", iso2: "NZ", dialCode: "+64" },
  { label: "Nicaragua", iso2: "NI", dialCode: "+505" },
  { label: "Niger", iso2: "NE", dialCode: "+227" },
  { label: "Nigeria", iso2: "NG", dialCode: "+234" },
  { label: "North Korea", iso2: "KP", dialCode: "+850" },
  { label: "North Macedonia", iso2: "MK", dialCode: "+389" },
  { label: "Norway", iso2: "NO", dialCode: "+47" },
  { label: "Oman", iso2: "OM", dialCode: "+968" },
  { label: "Pakistan", iso2: "PK", dialCode: "+92" },
  { label: "Palau", iso2: "PW", dialCode: "+680" },
  { label: "Palestine", iso2: "PS", dialCode: "+970" },
  { label: "Panama", iso2: "PA", dialCode: "+507" },
  { label: "Papua New Guinea", iso2: "PG", dialCode: "+675" },
  { label: "Paraguay", iso2: "PY", dialCode: "+595" },
  { label: "Peru", iso2: "PE", dialCode: "+51" },
  { label: "Philippines", iso2: "PH", dialCode: "+63" },
  { label: "Poland", iso2: "PL", dialCode: "+48" },
  { label: "Portugal", iso2: "PT", dialCode: "+351" },
  { label: "Qatar", iso2: "QA", dialCode: "+974" },
  { label: "Romania", iso2: "RO", dialCode: "+40" },
  { label: "Russia", iso2: "RU", dialCode: "+7" },
  { label: "Rwanda", iso2: "RW", dialCode: "+250" },
  { label: "Saint Kitts and Nevis", iso2: "KN", dialCode: "+1" },
  { label: "Saint Lucia", iso2: "LC", dialCode: "+1" },
  { label: "Saint Vincent and the Grenadines", iso2: "VC", dialCode: "+1" },
  { label: "Samoa", iso2: "WS", dialCode: "+685" },
  { label: "San Marino", iso2: "SM", dialCode: "+378" },
  { label: "Sao Tome and Principe", iso2: "ST", dialCode: "+239" },
  { label: "Saudi Arabia", iso2: "SA", dialCode: "+966" },
  { label: "Senegal", iso2: "SN", dialCode: "+221" },
  { label: "Serbia", iso2: "RS", dialCode: "+381" },
  { label: "Seychelles", iso2: "SC", dialCode: "+248" },
  { label: "Sierra Leone", iso2: "SL", dialCode: "+232" },
  { label: "Singapore", iso2: "SG", dialCode: "+65" },
  { label: "Slovakia", iso2: "SK", dialCode: "+421" },
  { label: "Slovenia", iso2: "SI", dialCode: "+386" },
  { label: "Solomon Islands", iso2: "SB", dialCode: "+677" },
  { label: "Somalia", iso2: "SO", dialCode: "+252" },
  { label: "South Africa", iso2: "ZA", dialCode: "+27" },
  { label: "South Korea", iso2: "KR", dialCode: "+82" },
  { label: "South Sudan", iso2: "SS", dialCode: "+211" },
  { label: "Spain", iso2: "ES", dialCode: "+34" },
  { label: "Sri Lanka", iso2: "LK", dialCode: "+94" },
  { label: "Sudan", iso2: "SD", dialCode: "+249" },
  { label: "Suriname", iso2: "SR", dialCode: "+597" },
  { label: "Sweden", iso2: "SE", dialCode: "+46" },
  { label: "Switzerland", iso2: "CH", dialCode: "+41" },
  { label: "Syria", iso2: "SY", dialCode: "+963" },
  { label: "Taiwan", iso2: "TW", dialCode: "+886" },
  { label: "Tajikistan", iso2: "TJ", dialCode: "+992" },
  { label: "Tanzania", iso2: "TZ", dialCode: "+255" },
  { label: "Thailand", iso2: "TH", dialCode: "+66" },
  { label: "Timor-Leste", iso2: "TL", dialCode: "+670" },
  { label: "Togo", iso2: "TG", dialCode: "+228" },
  { label: "Tonga", iso2: "TO", dialCode: "+676" },
  { label: "Trinidad and Tobago", iso2: "TT", dialCode: "+1" },
  { label: "Tunisia", iso2: "TN", dialCode: "+216" },
  { label: "Turkey", iso2: "TR", dialCode: "+90" },
  { label: "Turkmenistan", iso2: "TM", dialCode: "+993" },
  { label: "Tuvalu", iso2: "TV", dialCode: "+688" },
  { label: "Uganda", iso2: "UG", dialCode: "+256" },
  { label: "Ukraine", iso2: "UA", dialCode: "+380" },
  { label: "United Arab Emirates", iso2: "AE", dialCode: "+971" },
  { label: "United Kingdom", iso2: "GB", dialCode: "+44" },
  { label: "United States", iso2: "US", dialCode: "+1" },
  { label: "Uruguay", iso2: "UY", dialCode: "+598" },
  { label: "Uzbekistan", iso2: "UZ", dialCode: "+998" },
  { label: "Vanuatu", iso2: "VU", dialCode: "+678" },
  { label: "Vatican City", iso2: "VA", dialCode: "+379" },
  { label: "Venezuela", iso2: "VE", dialCode: "+58" },
  { label: "Vietnam", iso2: "VN", dialCode: "+84" },
  { label: "Yemen", iso2: "YE", dialCode: "+967" },
  { label: "Zambia", iso2: "ZM", dialCode: "+260" },
  { label: "Zimbabwe", iso2: "ZW", dialCode: "+263" },
];

const getFlagEmoji = (iso2: string) =>
  String.fromCodePoint(...iso2.toUpperCase().split("").map((character) => 127397 + character.charCodeAt(0)));

const createPhoneCountryOption = (entry: { label: string; iso2: string; dialCode: string }): PhoneCountryOption => ({
  label: entry.label,
  iso2: entry.iso2,
  dialCode: entry.dialCode,
  flag: getFlagEmoji(entry.iso2),
  value: entry.iso2,
});

export const PHONE_COUNTRY_CODES = PHONE_COUNTRY_DATA.map(createPhoneCountryOption);

export const DEFAULT_PHONE_COUNTRY_ISO2 = "US";

const COUNTRY_BY_ISO2 = new Map(PHONE_COUNTRY_CODES.map((option) => [option.iso2, option]));
const COUNTRY_BY_DIAL_CODE = [...PHONE_COUNTRY_CODES]
  .sort((first, second) => second.dialCode.length - first.dialCode.length);

export const normalizePhoneDigits = (value: string) => value.replace(/[^\d]/g, "");

export const getPhoneCountryByIso2 = (iso2?: string | null) =>
  COUNTRY_BY_ISO2.get((iso2 || DEFAULT_PHONE_COUNTRY_ISO2).trim().toUpperCase()) ||
  COUNTRY_BY_ISO2.get(DEFAULT_PHONE_COUNTRY_ISO2)!;

export const getPhoneCountryByDialCode = (dialCode?: string | null) => {
  const normalizedDialCode = (dialCode || "").trim();

  if (!normalizedDialCode) {
    return getPhoneCountryByIso2(DEFAULT_PHONE_COUNTRY_ISO2);
  }

  const matchedCountry = COUNTRY_BY_DIAL_CODE.find((country) => country.dialCode === normalizedDialCode);
  return matchedCountry || getPhoneCountryByIso2(DEFAULT_PHONE_COUNTRY_ISO2);
};

export const splitPhoneNumber = (value?: string | null) => {
  const normalized = (value || "").trim();

  if (!normalized) {
    const defaultCountry = getPhoneCountryByIso2(DEFAULT_PHONE_COUNTRY_ISO2);
    return { countryIso2: defaultCountry.iso2, countryDialCode: defaultCountry.dialCode, localNumber: "" };
  }

  const compact = normalized.replace(/\s+/g, "");

  for (const country of COUNTRY_BY_DIAL_CODE) {
    if (compact.startsWith(country.dialCode)) {
      return {
        countryIso2: country.iso2,
        countryDialCode: country.dialCode,
        localNumber: compact.slice(country.dialCode.length),
      };
    }
  }

  const defaultCountry = getPhoneCountryByIso2(DEFAULT_PHONE_COUNTRY_ISO2);
  return {
    countryIso2: defaultCountry.iso2,
    countryDialCode: defaultCountry.dialCode,
    localNumber: normalized,
  };
};

export const buildInternationalPhoneNumber = (countryDialCode: string, localNumber: string) => {
  const normalizedCountryCode = countryDialCode.trim() || getPhoneCountryByIso2(DEFAULT_PHONE_COUNTRY_ISO2).dialCode;
  const normalizedLocalNumber = normalizePhoneDigits(localNumber);

  return normalizedLocalNumber ? `${normalizedCountryCode}${normalizedLocalNumber}` : "";
};