import { db } from '../server/db.js';
import { counties } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// Illinois Counties - All 102 counties
const illinoisCounties = [
  { name: "Adams County", fips: "17001", stateCode: "IL" },
  { name: "Alexander County", fips: "17003", stateCode: "IL" },
  { name: "Bond County", fips: "17005", stateCode: "IL" },
  { name: "Boone County", fips: "17007", stateCode: "IL" },
  { name: "Brown County", fips: "17009", stateCode: "IL" },
  { name: "Bureau County", fips: "17011", stateCode: "IL" },
  { name: "Calhoun County", fips: "17013", stateCode: "IL" },
  { name: "Carroll County", fips: "17015", stateCode: "IL" },
  { name: "Cass County", fips: "17017", stateCode: "IL" },
  { name: "Champaign County", fips: "17019", stateCode: "IL" },
  { name: "Christian County", fips: "17021", stateCode: "IL" },
  { name: "Clark County", fips: "17023", stateCode: "IL" },
  { name: "Clay County", fips: "17025", stateCode: "IL" },
  { name: "Clinton County", fips: "17027", stateCode: "IL" },
  { name: "Coles County", fips: "17029", stateCode: "IL" },
  { name: "Cook County", fips: "17031", stateCode: "IL" },
  { name: "Crawford County", fips: "17033", stateCode: "IL" },
  { name: "Cumberland County", fips: "17035", stateCode: "IL" },
  { name: "DeKalb County", fips: "17037", stateCode: "IL" },
  { name: "De Witt County", fips: "17039", stateCode: "IL" },
  { name: "Douglas County", fips: "17041", stateCode: "IL" },
  { name: "DuPage County", fips: "17043", stateCode: "IL" },
  { name: "Edgar County", fips: "17045", stateCode: "IL" },
  { name: "Edwards County", fips: "17047", stateCode: "IL" },
  { name: "Effingham County", fips: "17049", stateCode: "IL" },
  { name: "Fayette County", fips: "17051", stateCode: "IL" },
  { name: "Ford County", fips: "17053", stateCode: "IL" },
  { name: "Franklin County", fips: "17055", stateCode: "IL" },
  { name: "Fulton County", fips: "17057", stateCode: "IL" },
  { name: "Gallatin County", fips: "17059", stateCode: "IL" },
  { name: "Greene County", fips: "17061", stateCode: "IL" },
  { name: "Grundy County", fips: "17063", stateCode: "IL" },
  { name: "Hamilton County", fips: "17065", stateCode: "IL" },
  { name: "Hancock County", fips: "17067", stateCode: "IL" },
  { name: "Hardin County", fips: "17069", stateCode: "IL" },
  { name: "Henderson County", fips: "17071", stateCode: "IL" },
  { name: "Henry County", fips: "17073", stateCode: "IL" },
  { name: "Iroquois County", fips: "17075", stateCode: "IL" },
  { name: "Jackson County", fips: "17077", stateCode: "IL" },
  { name: "Jasper County", fips: "17079", stateCode: "IL" },
  { name: "Jefferson County", fips: "17081", stateCode: "IL" },
  { name: "Jersey County", fips: "17083", stateCode: "IL" },
  { name: "Jo Daviess County", fips: "17085", stateCode: "IL" },
  { name: "Johnson County", fips: "17087", stateCode: "IL" },
  { name: "Kane County", fips: "17089", stateCode: "IL" },
  { name: "Kankakee County", fips: "17091", stateCode: "IL" },
  { name: "Kendall County", fips: "17093", stateCode: "IL" },
  { name: "Knox County", fips: "17095", stateCode: "IL" },
  { name: "Lake County", fips: "17097", stateCode: "IL" },
  { name: "LaSalle County", fips: "17099", stateCode: "IL" },
  { name: "Lawrence County", fips: "17101", stateCode: "IL" },
  { name: "Lee County", fips: "17103", stateCode: "IL" },
  { name: "Livingston County", fips: "17105", stateCode: "IL" },
  { name: "Logan County", fips: "17107", stateCode: "IL" },
  { name: "McDonough County", fips: "17109", stateCode: "IL" },
  { name: "McHenry County", fips: "17111", stateCode: "IL" },
  { name: "McLean County", fips: "17113", stateCode: "IL" },
  { name: "Macon County", fips: "17115", stateCode: "IL" },
  { name: "Macoupin County", fips: "17117", stateCode: "IL" },
  { name: "Madison County", fips: "17119", stateCode: "IL" },
  { name: "Marion County", fips: "17121", stateCode: "IL" },
  { name: "Marshall County", fips: "17123", stateCode: "IL" },
  { name: "Mason County", fips: "17125", stateCode: "IL" },
  { name: "Massac County", fips: "17127", stateCode: "IL" },
  { name: "Menard County", fips: "17129", stateCode: "IL" },
  { name: "Mercer County", fips: "17131", stateCode: "IL" },
  { name: "Monroe County", fips: "17133", stateCode: "IL" },
  { name: "Montgomery County", fips: "17135", stateCode: "IL" },
  { name: "Morgan County", fips: "17137", stateCode: "IL" },
  { name: "Moultrie County", fips: "17139", stateCode: "IL" },
  { name: "Ogle County", fips: "17141", stateCode: "IL" },
  { name: "Peoria County", fips: "17143", stateCode: "IL" },
  { name: "Perry County", fips: "17145", stateCode: "IL" },
  { name: "Piatt County", fips: "17147", stateCode: "IL" },
  { name: "Pike County", fips: "17149", stateCode: "IL" },
  { name: "Pope County", fips: "17151", stateCode: "IL" },
  { name: "Pulaski County", fips: "17153", stateCode: "IL" },
  { name: "Putnam County", fips: "17155", stateCode: "IL" },
  { name: "Randolph County", fips: "17157", stateCode: "IL" },
  { name: "Richland County", fips: "17159", stateCode: "IL" },
  { name: "Rock Island County", fips: "17161", stateCode: "IL" },
  { name: "St. Clair County", fips: "17163", stateCode: "IL" },
  { name: "Saline County", fips: "17165", stateCode: "IL" },
  { name: "Sangamon County", fips: "17167", stateCode: "IL" },
  { name: "Schuyler County", fips: "17169", stateCode: "IL" },
  { name: "Scott County", fips: "17171", stateCode: "IL" },
  { name: "Shelby County", fips: "17173", stateCode: "IL" },
  { name: "Stark County", fips: "17175", stateCode: "IL" },
  { name: "Stephenson County", fips: "17177", stateCode: "IL" },
  { name: "Tazewell County", fips: "17179", stateCode: "IL" },
  { name: "Union County", fips: "17181", stateCode: "IL" },
  { name: "Vermilion County", fips: "17183", stateCode: "IL" },
  { name: "Wabash County", fips: "17185", stateCode: "IL" },
  { name: "Warren County", fips: "17187", stateCode: "IL" },
  { name: "Washington County", fips: "17189", stateCode: "IL" },
  { name: "Wayne County", fips: "17191", stateCode: "IL" },
  { name: "White County", fips: "17193", stateCode: "IL" },
  { name: "Whiteside County", fips: "17195", stateCode: "IL" },
  { name: "Will County", fips: "17197", stateCode: "IL" },
  { name: "Williamson County", fips: "17199", stateCode: "IL" },
  { name: "Winnebago County", fips: "17201", stateCode: "IL" },
  { name: "Woodford County", fips: "17203", stateCode: "IL" }
];

export async function seedIllinoisCounties() {
  try {
    console.log("Starting Illinois county seeding...");
    
    await db.delete(counties).where(eq(counties.stateCode, 'IL'));
    
    const batchSize = 50;
    for (let i = 0; i < illinoisCounties.length; i += batchSize) {
      const batch = illinoisCounties.slice(i, i + batchSize);
      await db.insert(counties).values(batch);
      console.log(`Inserted IL batch ${Math.floor(i / batchSize) + 1}, counties ${i + 1}-${Math.min(i + batchSize, illinoisCounties.length)}`);
    }
    
    const count = await db.select().from(counties).where(eq(counties.stateCode, 'IL'));
    console.log(`Successfully seeded ${count.length} Illinois counties`);
    
    return count.length;
  } catch (error) {
    console.error("Error seeding Illinois counties:", error);
    throw error;
  }
}

seedIllinoisCounties()
  .then(() => {
    console.log("Illinois county seeding completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Illinois county seeding failed:", error);
    process.exit(1);
  });