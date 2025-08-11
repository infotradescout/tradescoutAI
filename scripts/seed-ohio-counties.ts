import { db } from '../server/db.js';
import { counties } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// Ohio Counties - All 88 counties
const ohioCounties = [
  { name: "Adams County", fips: "39001", stateCode: "OH" },
  { name: "Allen County", fips: "39003", stateCode: "OH" },
  { name: "Ashland County", fips: "39005", stateCode: "OH" },
  { name: "Ashtabula County", fips: "39007", stateCode: "OH" },
  { name: "Athens County", fips: "39009", stateCode: "OH" },
  { name: "Auglaize County", fips: "39011", stateCode: "OH" },
  { name: "Belmont County", fips: "39013", stateCode: "OH" },
  { name: "Brown County", fips: "39015", stateCode: "OH" },
  { name: "Butler County", fips: "39017", stateCode: "OH" },
  { name: "Carroll County", fips: "39019", stateCode: "OH" },
  { name: "Champaign County", fips: "39021", stateCode: "OH" },
  { name: "Clark County", fips: "39023", stateCode: "OH" },
  { name: "Clermont County", fips: "39025", stateCode: "OH" },
  { name: "Clinton County", fips: "39027", stateCode: "OH" },
  { name: "Columbiana County", fips: "39029", stateCode: "OH" },
  { name: "Coshocton County", fips: "39031", stateCode: "OH" },
  { name: "Crawford County", fips: "39033", stateCode: "OH" },
  { name: "Cuyahoga County", fips: "39035", stateCode: "OH" },
  { name: "Darke County", fips: "39037", stateCode: "OH" },
  { name: "Defiance County", fips: "39039", stateCode: "OH" },
  { name: "Delaware County", fips: "39041", stateCode: "OH" },
  { name: "Erie County", fips: "39043", stateCode: "OH" },
  { name: "Fairfield County", fips: "39045", stateCode: "OH" },
  { name: "Fayette County", fips: "39047", stateCode: "OH" },
  { name: "Franklin County", fips: "39049", stateCode: "OH" },
  { name: "Fulton County", fips: "39051", stateCode: "OH" },
  { name: "Gallia County", fips: "39053", stateCode: "OH" },
  { name: "Geauga County", fips: "39055", stateCode: "OH" },
  { name: "Greene County", fips: "39057", stateCode: "OH" },
  { name: "Guernsey County", fips: "39059", stateCode: "OH" },
  { name: "Hamilton County", fips: "39061", stateCode: "OH" },
  { name: "Hancock County", fips: "39063", stateCode: "OH" },
  { name: "Hardin County", fips: "39065", stateCode: "OH" },
  { name: "Harrison County", fips: "39067", stateCode: "OH" },
  { name: "Henry County", fips: "39069", stateCode: "OH" },
  { name: "Highland County", fips: "39071", stateCode: "OH" },
  { name: "Hocking County", fips: "39073", stateCode: "OH" },
  { name: "Holmes County", fips: "39075", stateCode: "OH" },
  { name: "Huron County", fips: "39077", stateCode: "OH" },
  { name: "Jackson County", fips: "39079", stateCode: "OH" },
  { name: "Jefferson County", fips: "39081", stateCode: "OH" },
  { name: "Knox County", fips: "39083", stateCode: "OH" },
  { name: "Lake County", fips: "39085", stateCode: "OH" },
  { name: "Lawrence County", fips: "39087", stateCode: "OH" },
  { name: "Licking County", fips: "39089", stateCode: "OH" },
  { name: "Logan County", fips: "39091", stateCode: "OH" },
  { name: "Lorain County", fips: "39093", stateCode: "OH" },
  { name: "Lucas County", fips: "39095", stateCode: "OH" },
  { name: "Madison County", fips: "39097", stateCode: "OH" },
  { name: "Mahoning County", fips: "39099", stateCode: "OH" },
  { name: "Marion County", fips: "39101", stateCode: "OH" },
  { name: "Medina County", fips: "39103", stateCode: "OH" },
  { name: "Meigs County", fips: "39105", stateCode: "OH" },
  { name: "Mercer County", fips: "39107", stateCode: "OH" },
  { name: "Miami County", fips: "39109", stateCode: "OH" },
  { name: "Monroe County", fips: "39111", stateCode: "OH" },
  { name: "Montgomery County", fips: "39113", stateCode: "OH" },
  { name: "Morgan County", fips: "39115", stateCode: "OH" },
  { name: "Morrow County", fips: "39117", stateCode: "OH" },
  { name: "Muskingum County", fips: "39119", stateCode: "OH" },
  { name: "Noble County", fips: "39121", stateCode: "OH" },
  { name: "Ottawa County", fips: "39123", stateCode: "OH" },
  { name: "Paulding County", fips: "39125", stateCode: "OH" },
  { name: "Perry County", fips: "39127", stateCode: "OH" },
  { name: "Pickaway County", fips: "39129", stateCode: "OH" },
  { name: "Pike County", fips: "39131", stateCode: "OH" },
  { name: "Portage County", fips: "39133", stateCode: "OH" },
  { name: "Preble County", fips: "39135", stateCode: "OH" },
  { name: "Putnam County", fips: "39137", stateCode: "OH" },
  { name: "Richland County", fips: "39139", stateCode: "OH" },
  { name: "Ross County", fips: "39141", stateCode: "OH" },
  { name: "Sandusky County", fips: "39143", stateCode: "OH" },
  { name: "Scioto County", fips: "39145", stateCode: "OH" },
  { name: "Seneca County", fips: "39147", stateCode: "OH" },
  { name: "Shelby County", fips: "39149", stateCode: "OH" },
  { name: "Stark County", fips: "39151", stateCode: "OH" },
  { name: "Summit County", fips: "39153", stateCode: "OH" },
  { name: "Trumbull County", fips: "39155", stateCode: "OH" },
  { name: "Tuscarawas County", fips: "39157", stateCode: "OH" },
  { name: "Union County", fips: "39159", stateCode: "OH" },
  { name: "Van Wert County", fips: "39161", stateCode: "OH" },
  { name: "Vinton County", fips: "39163", stateCode: "OH" },
  { name: "Warren County", fips: "39165", stateCode: "OH" },
  { name: "Washington County", fips: "39167", stateCode: "OH" },
  { name: "Wayne County", fips: "39169", stateCode: "OH" },
  { name: "Williams County", fips: "39171", stateCode: "OH" },
  { name: "Wood County", fips: "39173", stateCode: "OH" },
  { name: "Wyandot County", fips: "39175", stateCode: "OH" }
];

export async function seedOhioCounties() {
  try {
    console.log("Starting Ohio county seeding...");
    
    await db.delete(counties).where(eq(counties.stateCode, 'OH'));
    await db.insert(counties).values(ohioCounties);
    
    const count = await db.select().from(counties).where(eq(counties.stateCode, 'OH'));
    console.log(`Successfully seeded ${count.length} Ohio counties`);
    
    return count.length;
  } catch (error) {
    console.error("Error seeding Ohio counties:", error);
    throw error;
  }
}

seedOhioCounties()
  .then(() => {
    console.log("Ohio county seeding completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Ohio county seeding failed:", error);
    process.exit(1);
  });