import { db } from '../server/db.js';
import { counties } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// North Carolina Counties - All 100 counties
const northCarolinaCounties = [
  { name: "Alamance County", fips: "37001", stateCode: "NC" },
  { name: "Alexander County", fips: "37003", stateCode: "NC" },
  { name: "Alleghany County", fips: "37005", stateCode: "NC" },
  { name: "Anson County", fips: "37007", stateCode: "NC" },
  { name: "Ashe County", fips: "37009", stateCode: "NC" },
  { name: "Avery County", fips: "37011", stateCode: "NC" },
  { name: "Beaufort County", fips: "37013", stateCode: "NC" },
  { name: "Bertie County", fips: "37015", stateCode: "NC" },
  { name: "Bladen County", fips: "37017", stateCode: "NC" },
  { name: "Brunswick County", fips: "37019", stateCode: "NC" },
  { name: "Buncombe County", fips: "37021", stateCode: "NC" },
  { name: "Burke County", fips: "37023", stateCode: "NC" },
  { name: "Cabarrus County", fips: "37025", stateCode: "NC" },
  { name: "Caldwell County", fips: "37027", stateCode: "NC" },
  { name: "Camden County", fips: "37029", stateCode: "NC" },
  { name: "Carteret County", fips: "37031", stateCode: "NC" },
  { name: "Caswell County", fips: "37033", stateCode: "NC" },
  { name: "Catawba County", fips: "37035", stateCode: "NC" },
  { name: "Chatham County", fips: "37037", stateCode: "NC" },
  { name: "Cherokee County", fips: "37039", stateCode: "NC" },
  { name: "Chowan County", fips: "37041", stateCode: "NC" },
  { name: "Clay County", fips: "37043", stateCode: "NC" },
  { name: "Cleveland County", fips: "37045", stateCode: "NC" },
  { name: "Columbus County", fips: "37047", stateCode: "NC" },
  { name: "Craven County", fips: "37049", stateCode: "NC" },
  { name: "Cumberland County", fips: "37051", stateCode: "NC" },
  { name: "Currituck County", fips: "37053", stateCode: "NC" },
  { name: "Dare County", fips: "37055", stateCode: "NC" },
  { name: "Davidson County", fips: "37057", stateCode: "NC" },
  { name: "Davie County", fips: "37059", stateCode: "NC" },
  { name: "Duplin County", fips: "37061", stateCode: "NC" },
  { name: "Durham County", fips: "37063", stateCode: "NC" },
  { name: "Edgecombe County", fips: "37065", stateCode: "NC" },
  { name: "Forsyth County", fips: "37067", stateCode: "NC" },
  { name: "Franklin County", fips: "37069", stateCode: "NC" },
  { name: "Gaston County", fips: "37071", stateCode: "NC" },
  { name: "Gates County", fips: "37073", stateCode: "NC" },
  { name: "Graham County", fips: "37075", stateCode: "NC" },
  { name: "Granville County", fips: "37077", stateCode: "NC" },
  { name: "Greene County", fips: "37079", stateCode: "NC" },
  { name: "Guilford County", fips: "37081", stateCode: "NC" },
  { name: "Halifax County", fips: "37083", stateCode: "NC" },
  { name: "Harnett County", fips: "37085", stateCode: "NC" },
  { name: "Haywood County", fips: "37087", stateCode: "NC" },
  { name: "Henderson County", fips: "37089", stateCode: "NC" },
  { name: "Hertford County", fips: "37091", stateCode: "NC" },
  { name: "Hoke County", fips: "37093", stateCode: "NC" },
  { name: "Hyde County", fips: "37095", stateCode: "NC" },
  { name: "Iredell County", fips: "37097", stateCode: "NC" },
  { name: "Jackson County", fips: "37099", stateCode: "NC" },
  { name: "Johnston County", fips: "37101", stateCode: "NC" },
  { name: "Jones County", fips: "37103", stateCode: "NC" },
  { name: "Lee County", fips: "37105", stateCode: "NC" },
  { name: "Lenoir County", fips: "37107", stateCode: "NC" },
  { name: "Lincoln County", fips: "37109", stateCode: "NC" },
  { name: "McDowell County", fips: "37111", stateCode: "NC" },
  { name: "Macon County", fips: "37113", stateCode: "NC" },
  { name: "Madison County", fips: "37115", stateCode: "NC" },
  { name: "Martin County", fips: "37117", stateCode: "NC" },
  { name: "Mecklenburg County", fips: "37119", stateCode: "NC" },
  { name: "Mitchell County", fips: "37121", stateCode: "NC" },
  { name: "Montgomery County", fips: "37123", stateCode: "NC" },
  { name: "Moore County", fips: "37125", stateCode: "NC" },
  { name: "Nash County", fips: "37127", stateCode: "NC" },
  { name: "New Hanover County", fips: "37129", stateCode: "NC" },
  { name: "Northampton County", fips: "37131", stateCode: "NC" },
  { name: "Onslow County", fips: "37133", stateCode: "NC" },
  { name: "Orange County", fips: "37135", stateCode: "NC" },
  { name: "Pamlico County", fips: "37137", stateCode: "NC" },
  { name: "Pasquotank County", fips: "37139", stateCode: "NC" },
  { name: "Pender County", fips: "37141", stateCode: "NC" },
  { name: "Perquimans County", fips: "37143", stateCode: "NC" },
  { name: "Person County", fips: "37145", stateCode: "NC" },
  { name: "Pitt County", fips: "37147", stateCode: "NC" },
  { name: "Polk County", fips: "37149", stateCode: "NC" },
  { name: "Randolph County", fips: "37151", stateCode: "NC" },
  { name: "Richmond County", fips: "37153", stateCode: "NC" },
  { name: "Robeson County", fips: "37155", stateCode: "NC" },
  { name: "Rockingham County", fips: "37157", stateCode: "NC" },
  { name: "Rowan County", fips: "37159", stateCode: "NC" },
  { name: "Rutherford County", fips: "37161", stateCode: "NC" },
  { name: "Sampson County", fips: "37163", stateCode: "NC" },
  { name: "Scotland County", fips: "37165", stateCode: "NC" },
  { name: "Stanly County", fips: "37167", stateCode: "NC" },
  { name: "Stokes County", fips: "37169", stateCode: "NC" },
  { name: "Surry County", fips: "37171", stateCode: "NC" },
  { name: "Swain County", fips: "37173", stateCode: "NC" },
  { name: "Transylvania County", fips: "37175", stateCode: "NC" },
  { name: "Tyrrell County", fips: "37177", stateCode: "NC" },
  { name: "Union County", fips: "37179", stateCode: "NC" },
  { name: "Vance County", fips: "37181", stateCode: "NC" },
  { name: "Wake County", fips: "37183", stateCode: "NC" },
  { name: "Warren County", fips: "37185", stateCode: "NC" },
  { name: "Washington County", fips: "37187", stateCode: "NC" },
  { name: "Watauga County", fips: "37189", stateCode: "NC" },
  { name: "Wayne County", fips: "37191", stateCode: "NC" },
  { name: "Wilkes County", fips: "37193", stateCode: "NC" },
  { name: "Wilson County", fips: "37195", stateCode: "NC" },
  { name: "Yadkin County", fips: "37197", stateCode: "NC" },
  { name: "Yancey County", fips: "37199", stateCode: "NC" }
];

export async function seedNorthCarolinaCounties() {
  try {
    console.log("Starting North Carolina county seeding...");
    
    await db.delete(counties).where(eq(counties.stateCode, 'NC'));
    
    const batchSize = 50;
    for (let i = 0; i < northCarolinaCounties.length; i += batchSize) {
      const batch = northCarolinaCounties.slice(i, i + batchSize);
      await db.insert(counties).values(batch);
      console.log(`Inserted NC batch ${Math.floor(i / batchSize) + 1}, counties ${i + 1}-${Math.min(i + batchSize, northCarolinaCounties.length)}`);
    }
    
    const count = await db.select().from(counties).where(eq(counties.stateCode, 'NC'));
    console.log(`Successfully seeded ${count.length} North Carolina counties`);
    
    return count.length;
  } catch (error) {
    console.error("Error seeding North Carolina counties:", error);
    throw error;
  }
}

seedNorthCarolinaCounties()
  .then(() => {
    console.log("North Carolina county seeding completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("North Carolina county seeding failed:", error);
    process.exit(1);
  });