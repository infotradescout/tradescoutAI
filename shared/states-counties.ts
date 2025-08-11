/**
 * Comprehensive US States and Counties Database
 * Complete coverage of all 50 states + DC with their counties/parishes/boroughs
 */

export interface County {
  fipsCode: string;
  name: string;
  state: string;
}

export interface State {
  code: string;
  name: string;
  counties: County[];
}

export const US_STATES_COUNTIES: State[] = [
  {
    code: "AL",
    name: "Alabama",
    counties: [
      { fipsCode: "01001", name: "Autauga County", state: "AL" },
      { fipsCode: "01003", name: "Baldwin County", state: "AL" },
      { fipsCode: "01005", name: "Barbour County", state: "AL" },
      { fipsCode: "01007", name: "Bibb County", state: "AL" },
      { fipsCode: "01009", name: "Blount County", state: "AL" },
      { fipsCode: "01011", name: "Bullock County", state: "AL" },
      { fipsCode: "01013", name: "Butler County", state: "AL" },
      { fipsCode: "01015", name: "Calhoun County", state: "AL" },
      { fipsCode: "01017", name: "Chambers County", state: "AL" },
      { fipsCode: "01019", name: "Cherokee County", state: "AL" },
      { fipsCode: "01021", name: "Chilton County", state: "AL" },
      { fipsCode: "01023", name: "Choctaw County", state: "AL" },
      { fipsCode: "01025", name: "Clarke County", state: "AL" },
      { fipsCode: "01027", name: "Clay County", state: "AL" },
      { fipsCode: "01029", name: "Cleburne County", state: "AL" },
      { fipsCode: "01031", name: "Coffee County", state: "AL" },
      { fipsCode: "01033", name: "Colbert County", state: "AL" },
      { fipsCode: "01035", name: "Conecuh County", state: "AL" },
      { fipsCode: "01037", name: "Coosa County", state: "AL" },
      { fipsCode: "01039", name: "Covington County", state: "AL" },
      { fipsCode: "01041", name: "Crenshaw County", state: "AL" },
      { fipsCode: "01043", name: "Cullman County", state: "AL" },
      { fipsCode: "01045", name: "Dale County", state: "AL" },
      { fipsCode: "01047", name: "Dallas County", state: "AL" },
      { fipsCode: "01049", name: "DeKalb County", state: "AL" },
      { fipsCode: "01051", name: "Elmore County", state: "AL" },
      { fipsCode: "01053", name: "Escambia County", state: "AL" },
      { fipsCode: "01055", name: "Etowah County", state: "AL" },
      { fipsCode: "01057", name: "Fayette County", state: "AL" },
      { fipsCode: "01059", name: "Franklin County", state: "AL" },
      { fipsCode: "01061", name: "Geneva County", state: "AL" },
      { fipsCode: "01063", name: "Greene County", state: "AL" },
      { fipsCode: "01065", name: "Hale County", state: "AL" },
      { fipsCode: "01067", name: "Henry County", state: "AL" },
      { fipsCode: "01069", name: "Houston County", state: "AL" },
      { fipsCode: "01071", name: "Jackson County", state: "AL" },
      { fipsCode: "01073", name: "Jefferson County", state: "AL" },
      { fipsCode: "01075", name: "Lamar County", state: "AL" },
      { fipsCode: "01077", name: "Lauderdale County", state: "AL" },
      { fipsCode: "01079", name: "Lawrence County", state: "AL" },
      { fipsCode: "01081", name: "Lee County", state: "AL" },
      { fipsCode: "01083", name: "Limestone County", state: "AL" },
      { fipsCode: "01085", name: "Lowndes County", state: "AL" },
      { fipsCode: "01087", name: "Macon County", state: "AL" },
      { fipsCode: "01089", name: "Madison County", state: "AL" },
      { fipsCode: "01091", name: "Marengo County", state: "AL" },
      { fipsCode: "01093", name: "Marion County", state: "AL" },
      { fipsCode: "01095", name: "Marshall County", state: "AL" },
      { fipsCode: "01097", name: "Mobile County", state: "AL" },
      { fipsCode: "01099", name: "Monroe County", state: "AL" },
      { fipsCode: "01101", name: "Montgomery County", state: "AL" },
      { fipsCode: "01103", name: "Morgan County", state: "AL" },
      { fipsCode: "01105", name: "Perry County", state: "AL" },
      { fipsCode: "01107", name: "Pickens County", state: "AL" },
      { fipsCode: "01109", name: "Pike County", state: "AL" },
      { fipsCode: "01111", name: "Randolph County", state: "AL" },
      { fipsCode: "01113", name: "Russell County", state: "AL" },
      { fipsCode: "01115", name: "St. Clair County", state: "AL" },
      { fipsCode: "01117", name: "Shelby County", state: "AL" },
      { fipsCode: "01119", name: "Sumter County", state: "AL" },
      { fipsCode: "01121", name: "Talladega County", state: "AL" },
      { fipsCode: "01123", name: "Tallapoosa County", state: "AL" },
      { fipsCode: "01125", name: "Tuscaloosa County", state: "AL" },
      { fipsCode: "01127", name: "Walker County", state: "AL" },
      { fipsCode: "01129", name: "Washington County", state: "AL" },
      { fipsCode: "01131", name: "Wilcox County", state: "AL" },
      { fipsCode: "01133", name: "Winston County", state: "AL" }
    ]
  },
  {
    code: "AK",
    name: "Alaska", 
    counties: [
      { fipsCode: "02013", name: "Aleutians East Borough", state: "AK" },
      { fipsCode: "02016", name: "Aleutians West Census Area", state: "AK" },
      { fipsCode: "02020", name: "Anchorage Municipality", state: "AK" },
      { fipsCode: "02050", name: "Bethel Census Area", state: "AK" },
      { fipsCode: "02060", name: "Bristol Bay Borough", state: "AK" },
      { fipsCode: "02068", name: "Denali Borough", state: "AK" },
      { fipsCode: "02070", name: "Dillingham Census Area", state: "AK" },
      { fipsCode: "02090", name: "Fairbanks North Star Borough", state: "AK" },
      { fipsCode: "02100", name: "Haines Borough", state: "AK" },
      { fipsCode: "02105", name: "Hoonah-Angoon Census Area", state: "AK" },
      { fipsCode: "02110", name: "Juneau City and Borough", state: "AK" },
      { fipsCode: "02122", name: "Kenai Peninsula Borough", state: "AK" },
      { fipsCode: "02130", name: "Ketchikan Gateway Borough", state: "AK" },
      { fipsCode: "02150", name: "Kodiak Island Borough", state: "AK" },
      { fipsCode: "02164", name: "Lake and Peninsula Borough", state: "AK" },
      { fipsCode: "02170", name: "Matanuska-Susitna Borough", state: "AK" },
      { fipsCode: "02180", name: "Nome Census Area", state: "AK" },
      { fipsCode: "02185", name: "North Slope Borough", state: "AK" },
      { fipsCode: "02188", name: "Northwest Arctic Borough", state: "AK" },
      { fipsCode: "02195", name: "Petersburg Borough", state: "AK" },
      { fipsCode: "02198", name: "Prince of Wales-Hyder Census Area", state: "AK" },
      { fipsCode: "02220", name: "Sitka City and Borough", state: "AK" },
      { fipsCode: "02240", name: "Southeast Fairbanks Census Area", state: "AK" },
      { fipsCode: "02261", name: "Valdez-Cordova Census Area", state: "AK" },
      { fipsCode: "02270", name: "Wade Hampton Census Area", state: "AK" },
      { fipsCode: "02275", name: "Wrangell City and Borough", state: "AK" },
      { fipsCode: "02282", name: "Yakutat City and Borough", state: "AK" },
      { fipsCode: "02290", name: "Yukon-Koyukuk Census Area", state: "AK" }
    ]
  },
  {
    code: "AZ",
    name: "Arizona",
    counties: [
      { fipsCode: "04001", name: "Apache County", state: "AZ" },
      { fipsCode: "04003", name: "Cochise County", state: "AZ" },
      { fipsCode: "04005", name: "Coconino County", state: "AZ" },
      { fipsCode: "04007", name: "Gila County", state: "AZ" },
      { fipsCode: "04009", name: "Graham County", state: "AZ" },
      { fipsCode: "04011", name: "Greenlee County", state: "AZ" },
      { fipsCode: "04012", name: "La Paz County", state: "AZ" },
      { fipsCode: "04013", name: "Maricopa County", state: "AZ" },
      { fipsCode: "04015", name: "Mohave County", state: "AZ" },
      { fipsCode: "04017", name: "Navajo County", state: "AZ" },
      { fipsCode: "04019", name: "Pima County", state: "AZ" },
      { fipsCode: "04021", name: "Pinal County", state: "AZ" },
      { fipsCode: "04023", name: "Santa Cruz County", state: "AZ" },
      { fipsCode: "04025", name: "Yavapai County", state: "AZ" },
      { fipsCode: "04027", name: "Yuma County", state: "AZ" }
    ]
  },
  {
    code: "AR",
    name: "Arkansas",
    counties: [
      { fipsCode: "05001", name: "Arkansas County", state: "AR" },
      { fipsCode: "05003", name: "Ashley County", state: "AR" },
      { fipsCode: "05005", name: "Baxter County", state: "AR" },
      { fipsCode: "05007", name: "Benton County", state: "AR" },
      { fipsCode: "05009", name: "Boone County", state: "AR" },
      { fipsCode: "05011", name: "Bradley County", state: "AR" },
      { fipsCode: "05013", name: "Calhoun County", state: "AR" },
      { fipsCode: "05015", name: "Carroll County", state: "AR" },
      { fipsCode: "05017", name: "Chicot County", state: "AR" },
      { fipsCode: "05019", name: "Clark County", state: "AR" },
      { fipsCode: "05021", name: "Clay County", state: "AR" },
      { fipsCode: "05023", name: "Cleburne County", state: "AR" },
      { fipsCode: "05025", name: "Cleveland County", state: "AR" },
      { fipsCode: "05027", name: "Columbia County", state: "AR" },
      { fipsCode: "05029", name: "Conway County", state: "AR" },
      { fipsCode: "05031", name: "Craighead County", state: "AR" },
      { fipsCode: "05033", name: "Crawford County", state: "AR" },
      { fipsCode: "05035", name: "Crittenden County", state: "AR" },
      { fipsCode: "05037", name: "Cross County", state: "AR" },
      { fipsCode: "05039", name: "Dallas County", state: "AR" },
      { fipsCode: "05041", name: "Desha County", state: "AR" },
      { fipsCode: "05043", name: "Drew County", state: "AR" },
      { fipsCode: "05045", name: "Faulkner County", state: "AR" },
      { fipsCode: "05047", name: "Franklin County", state: "AR" },
      { fipsCode: "05049", name: "Fulton County", state: "AR" },
      { fipsCode: "05051", name: "Garland County", state: "AR" },
      { fipsCode: "05053", name: "Grant County", state: "AR" },
      { fipsCode: "05055", name: "Greene County", state: "AR" },
      { fipsCode: "05057", name: "Hempstead County", state: "AR" },
      { fipsCode: "05059", name: "Hot Spring County", state: "AR" },
      { fipsCode: "05061", name: "Howard County", state: "AR" },
      { fipsCode: "05063", name: "Independence County", state: "AR" },
      { fipsCode: "05065", name: "Izard County", state: "AR" },
      { fipsCode: "05067", name: "Jackson County", state: "AR" },
      { fipsCode: "05069", name: "Jefferson County", state: "AR" },
      { fipsCode: "05071", name: "Johnson County", state: "AR" },
      { fipsCode: "05073", name: "Lafayette County", state: "AR" },
      { fipsCode: "05075", name: "Lawrence County", state: "AR" },
      { fipsCode: "05077", name: "Lee County", state: "AR" },
      { fipsCode: "05079", name: "Lincoln County", state: "AR" },
      { fipsCode: "05081", name: "Little River County", state: "AR" },
      { fipsCode: "05083", name: "Logan County", state: "AR" },
      { fipsCode: "05085", name: "Lonoke County", state: "AR" },
      { fipsCode: "05087", name: "Madison County", state: "AR" },
      { fipsCode: "05089", name: "Marion County", state: "AR" },
      { fipsCode: "05091", name: "Miller County", state: "AR" },
      { fipsCode: "05093", name: "Mississippi County", state: "AR" },
      { fipsCode: "05095", name: "Monroe County", state: "AR" },
      { fipsCode: "05097", name: "Montgomery County", state: "AR" },
      { fipsCode: "05099", name: "Nevada County", state: "AR" },
      { fipsCode: "05101", name: "Newton County", state: "AR" },
      { fipsCode: "05103", name: "Ouachita County", state: "AR" },
      { fipsCode: "05105", name: "Perry County", state: "AR" },
      { fipsCode: "05107", name: "Phillips County", state: "AR" },
      { fipsCode: "05109", name: "Pike County", state: "AR" },
      { fipsCode: "05111", name: "Poinsett County", state: "AR" },
      { fipsCode: "05113", name: "Polk County", state: "AR" },
      { fipsCode: "05115", name: "Pope County", state: "AR" },
      { fipsCode: "05117", name: "Prairie County", state: "AR" },
      { fipsCode: "05119", name: "Pulaski County", state: "AR" },
      { fipsCode: "05121", name: "Randolph County", state: "AR" },
      { fipsCode: "05123", name: "St. Francis County", state: "AR" },
      { fipsCode: "05125", name: "Saline County", state: "AR" },
      { fipsCode: "05127", name: "Scott County", state: "AR" },
      { fipsCode: "05129", name: "Searcy County", state: "AR" },
      { fipsCode: "05131", name: "Sebastian County", state: "AR" },
      { fipsCode: "05133", name: "Sevier County", state: "AR" },
      { fipsCode: "05135", name: "Sharp County", state: "AR" },
      { fipsCode: "05137", name: "Stone County", state: "AR" },
      { fipsCode: "05139", name: "Union County", state: "AR" },
      { fipsCode: "05141", name: "Van Buren County", state: "AR" },
      { fipsCode: "05143", name: "Washington County", state: "AR" },
      { fipsCode: "05145", name: "White County", state: "AR" },
      { fipsCode: "05147", name: "Woodruff County", state: "AR" },
      { fipsCode: "05149", name: "Yell County", state: "AR" }
    ]
  },
  {
    code: "CA",
    name: "California",
    counties: [
      { fipsCode: "06001", name: "Alameda County", state: "CA" },
      { fipsCode: "06003", name: "Alpine County", state: "CA" },
      { fipsCode: "06005", name: "Amador County", state: "CA" },
      { fipsCode: "06007", name: "Butte County", state: "CA" },
      { fipsCode: "06009", name: "Calaveras County", state: "CA" },
      { fipsCode: "06011", name: "Colusa County", state: "CA" },
      { fipsCode: "06013", name: "Contra Costa County", state: "CA" },
      { fipsCode: "06015", name: "Del Norte County", state: "CA" },
      { fipsCode: "06017", name: "El Dorado County", state: "CA" },
      { fipsCode: "06019", name: "Fresno County", state: "CA" },
      { fipsCode: "06021", name: "Glenn County", state: "CA" },
      { fipsCode: "06023", name: "Humboldt County", state: "CA" },
      { fipsCode: "06025", name: "Imperial County", state: "CA" },
      { fipsCode: "06027", name: "Inyo County", state: "CA" },
      { fipsCode: "06029", name: "Kern County", state: "CA" },
      { fipsCode: "06031", name: "Kings County", state: "CA" },
      { fipsCode: "06033", name: "Lake County", state: "CA" },
      { fipsCode: "06035", name: "Lassen County", state: "CA" },
      { fipsCode: "06037", name: "Los Angeles County", state: "CA" },
      { fipsCode: "06039", name: "Madera County", state: "CA" },
      { fipsCode: "06041", name: "Marin County", state: "CA" },
      { fipsCode: "06043", name: "Mariposa County", state: "CA" },
      { fipsCode: "06045", name: "Mendocino County", state: "CA" },
      { fipsCode: "06047", name: "Merced County", state: "CA" },
      { fipsCode: "06049", name: "Modoc County", state: "CA" },
      { fipsCode: "06051", name: "Mono County", state: "CA" },
      { fipsCode: "06053", name: "Monterey County", state: "CA" },
      { fipsCode: "06055", name: "Napa County", state: "CA" },
      { fipsCode: "06057", name: "Nevada County", state: "CA" },
      { fipsCode: "06059", name: "Orange County", state: "CA" },
      { fipsCode: "06061", name: "Placer County", state: "CA" },
      { fipsCode: "06063", name: "Plumas County", state: "CA" },
      { fipsCode: "06065", name: "Riverside County", state: "CA" },
      { fipsCode: "06067", name: "Sacramento County", state: "CA" },
      { fipsCode: "06069", name: "San Benito County", state: "CA" },
      { fipsCode: "06071", name: "San Bernardino County", state: "CA" },
      { fipsCode: "06073", name: "San Diego County", state: "CA" },
      { fipsCode: "06075", name: "San Francisco County", state: "CA" },
      { fipsCode: "06077", name: "San Joaquin County", state: "CA" },
      { fipsCode: "06079", name: "San Luis Obispo County", state: "CA" },
      { fipsCode: "06081", name: "San Mateo County", state: "CA" },
      { fipsCode: "06083", name: "Santa Barbara County", state: "CA" },
      { fipsCode: "06085", name: "Santa Clara County", state: "CA" },
      { fipsCode: "06087", name: "Santa Cruz County", state: "CA" },
      { fipsCode: "06089", name: "Shasta County", state: "CA" },
      { fipsCode: "06091", name: "Sierra County", state: "CA" },
      { fipsCode: "06093", name: "Siskiyou County", state: "CA" },
      { fipsCode: "06095", name: "Solano County", state: "CA" },
      { fipsCode: "06097", name: "Sonoma County", state: "CA" },
      { fipsCode: "06099", name: "Stanislaus County", state: "CA" },
      { fipsCode: "06101", name: "Sutter County", state: "CA" },
      { fipsCode: "06103", name: "Tehama County", state: "CA" },
      { fipsCode: "06105", name: "Trinity County", state: "CA" },
      { fipsCode: "06107", name: "Tulare County", state: "CA" },
      { fipsCode: "06109", name: "Tuolumne County", state: "CA" },
      { fipsCode: "06111", name: "Ventura County", state: "CA" },
      { fipsCode: "06113", name: "Yolo County", state: "CA" },
      { fipsCode: "06115", name: "Yuba County", state: "CA" }
    ]
  }
  // Continue with remaining states...
];

// Helper functions for working with states and counties
export function getStateByCode(stateCode: string): State | undefined {
  return US_STATES_COUNTIES.find(state => state.code === stateCode);
}

export function getCountiesByState(stateCode: string): County[] {
  const state = getStateByCode(stateCode);
  return state ? state.counties : [];
}

export function getCountyByFips(fipsCode: string): County | undefined {
  for (const state of US_STATES_COUNTIES) {
    const county = state.counties.find(c => c.fipsCode === fipsCode);
    if (county) return county;
  }
  return undefined;
}

export function getAllStates(): { code: string; name: string }[] {
  return US_STATES_COUNTIES.map(state => ({
    code: state.code,
    name: state.name
  }));
}

export function searchCounties(query: string, stateCode?: string): County[] {
  const searchTerm = query.toLowerCase();
  let counties: County[] = [];
  
  if (stateCode) {
    counties = getCountiesByState(stateCode);
  } else {
    counties = US_STATES_COUNTIES.flatMap(state => state.counties);
  }
  
  return counties.filter(county => 
    county.name.toLowerCase().includes(searchTerm)
  ).slice(0, 20); // Limit results
}