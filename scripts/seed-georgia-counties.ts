import { db } from "../src/db/drizzle-mock";
import { counties } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// Georgia Counties - All 159 counties
const georgiaCounties = [
  { name: "Appling County", fips: "13001", stateCode: "GA" },
  { name: "Atkinson County", fips: "13003", stateCode: "GA" },
  { name: "Bacon County", fips: "13005", stateCode: "GA" },
  { name: "Baker County", fips: "13007", stateCode: "GA" },
  { name: "Baldwin County", fips: "13009", stateCode: "GA" },
  { name: "Banks County", fips: "13011", stateCode: "GA" },
  { name: "Barrow County", fips: "13013", stateCode: "GA" },
  { name: "Bartow County", fips: "13015", stateCode: "GA" },
  { name: "Ben Hill County", fips: "13017", stateCode: "GA" },
  { name: "Berrien County", fips: "13019", stateCode: "GA" },
  { name: "Bibb County", fips: "13021", stateCode: "GA" },
  { name: "Bleckley County", fips: "13023", stateCode: "GA" },
  { name: "Brantley County", fips: "13025", stateCode: "GA" },
  { name: "Brooks County", fips: "13027", stateCode: "GA" },
  { name: "Bryan County", fips: "13029", stateCode: "GA" },
  { name: "Bulloch County", fips: "13031", stateCode: "GA" },
  { name: "Burke County", fips: "13033", stateCode: "GA" },
  { name: "Butts County", fips: "13035", stateCode: "GA" },
  { name: "Calhoun County", fips: "13037", stateCode: "GA" },
  { name: "Camden County", fips: "13039", stateCode: "GA" },
  { name: "Candler County", fips: "13043", stateCode: "GA" },
  { name: "Carroll County", fips: "13045", stateCode: "GA" },
  { name: "Catoosa County", fips: "13047", stateCode: "GA" },
  { name: "Charlton County", fips: "13049", stateCode: "GA" },
  { name: "Chatham County", fips: "13051", stateCode: "GA" },
  { name: "Chattahoochee County", fips: "13053", stateCode: "GA" },
  { name: "Chattooga County", fips: "13055", stateCode: "GA" },
  { name: "Cherokee County", fips: "13057", stateCode: "GA" },
  { name: "Clarke County", fips: "13059", stateCode: "GA" },
  { name: "Clay County", fips: "13061", stateCode: "GA" },
  { name: "Clayton County", fips: "13063", stateCode: "GA" },
  { name: "Clinch County", fips: "13065", stateCode: "GA" },
  { name: "Cobb County", fips: "13067", stateCode: "GA" },
  { name: "Coffee County", fips: "13069", stateCode: "GA" },
  { name: "Colquitt County", fips: "13071", stateCode: "GA" },
  { name: "Columbia County", fips: "13073", stateCode: "GA" },
  { name: "Cook County", fips: "13075", stateCode: "GA" },
  { name: "Coweta County", fips: "13077", stateCode: "GA" },
  { name: "Crawford County", fips: "13079", stateCode: "GA" },
  { name: "Crisp County", fips: "13081", stateCode: "GA" },
  { name: "Dade County", fips: "13083", stateCode: "GA" },
  { name: "Dawson County", fips: "13085", stateCode: "GA" },
  { name: "Decatur County", fips: "13087", stateCode: "GA" },
  { name: "DeKalb County", fips: "13089", stateCode: "GA" },
  { name: "Dodge County", fips: "13091", stateCode: "GA" },
  { name: "Dooly County", fips: "13093", stateCode: "GA" },
  { name: "Dougherty County", fips: "13095", stateCode: "GA" },
  { name: "Douglas County", fips: "13097", stateCode: "GA" },
  { name: "Early County", fips: "13099", stateCode: "GA" },
  { name: "Echols County", fips: "13101", stateCode: "GA" },
  { name: "Effingham County", fips: "13103", stateCode: "GA" },
  { name: "Elbert County", fips: "13105", stateCode: "GA" },
  { name: "Emanuel County", fips: "13107", stateCode: "GA" },
  { name: "Evans County", fips: "13109", stateCode: "GA" },
  { name: "Fannin County", fips: "13111", stateCode: "GA" },
  { name: "Fayette County", fips: "13113", stateCode: "GA" },
  { name: "Floyd County", fips: "13115", stateCode: "GA" },
  { name: "Forsyth County", fips: "13117", stateCode: "GA" },
  { name: "Franklin County", fips: "13119", stateCode: "GA" },
  { name: "Fulton County", fips: "13121", stateCode: "GA" },
  { name: "Gilmer County", fips: "13123", stateCode: "GA" },
  { name: "Glascock County", fips: "13125", stateCode: "GA" },
  { name: "Glynn County", fips: "13127", stateCode: "GA" },
  { name: "Gordon County", fips: "13129", stateCode: "GA" },
  { name: "Grady County", fips: "13131", stateCode: "GA" },
  { name: "Greene County", fips: "13133", stateCode: "GA" },
  { name: "Gwinnett County", fips: "13135", stateCode: "GA" },
  { name: "Habersham County", fips: "13137", stateCode: "GA" },
  { name: "Hall County", fips: "13139", stateCode: "GA" },
  { name: "Hancock County", fips: "13141", stateCode: "GA" },
  { name: "Haralson County", fips: "13143", stateCode: "GA" },
  { name: "Harris County", fips: "13145", stateCode: "GA" },
  { name: "Hart County", fips: "13147", stateCode: "GA" },
  { name: "Heard County", fips: "13149", stateCode: "GA" },
  { name: "Henry County", fips: "13151", stateCode: "GA" },
  { name: "Houston County", fips: "13153", stateCode: "GA" },
  { name: "Irwin County", fips: "13155", stateCode: "GA" },
  { name: "Jackson County", fips: "13157", stateCode: "GA" },
  { name: "Jasper County", fips: "13159", stateCode: "GA" },
  { name: "Jeff Davis County", fips: "13161", stateCode: "GA" },
  { name: "Jefferson County", fips: "13163", stateCode: "GA" },
  { name: "Jenkins County", fips: "13165", stateCode: "GA" },
  { name: "Johnson County", fips: "13167", stateCode: "GA" },
  { name: "Jones County", fips: "13169", stateCode: "GA" },
  { name: "Lamar County", fips: "13171", stateCode: "GA" },
  { name: "Lanier County", fips: "13173", stateCode: "GA" },
  { name: "Laurens County", fips: "13175", stateCode: "GA" },
  { name: "Lee County", fips: "13177", stateCode: "GA" },
  { name: "Liberty County", fips: "13179", stateCode: "GA" },
  { name: "Lincoln County", fips: "13181", stateCode: "GA" },
  { name: "Long County", fips: "13183", stateCode: "GA" },
  { name: "Lowndes County", fips: "13185", stateCode: "GA" },
  { name: "Lumpkin County", fips: "13187", stateCode: "GA" },
  { name: "Macon County", fips: "13193", stateCode: "GA" },
  { name: "Madison County", fips: "13195", stateCode: "GA" },
  { name: "Marion County", fips: "13197", stateCode: "GA" },
  { name: "McDuffie County", fips: "13189", stateCode: "GA" },
  { name: "McIntosh County", fips: "13191", stateCode: "GA" },
  { name: "Meriwether County", fips: "13199", stateCode: "GA" },
  { name: "Miller County", fips: "13201", stateCode: "GA" },
  { name: "Mitchell County", fips: "13205", stateCode: "GA" },
  { name: "Monroe County", fips: "13207", stateCode: "GA" },
  { name: "Montgomery County", fips: "13209", stateCode: "GA" },
  { name: "Morgan County", fips: "13211", stateCode: "GA" },
  { name: "Murray County", fips: "13213", stateCode: "GA" },
  { name: "Muscogee County", fips: "13215", stateCode: "GA" },
  { name: "Newton County", fips: "13217", stateCode: "GA" },
  { name: "Oconee County", fips: "13219", stateCode: "GA" },
  { name: "Oglethorpe County", fips: "13221", stateCode: "GA" },
  { name: "Paulding County", fips: "13223", stateCode: "GA" },
  { name: "Peach County", fips: "13225", stateCode: "GA" },
  { name: "Pickens County", fips: "13227", stateCode: "GA" },
  { name: "Pierce County", fips: "13229", stateCode: "GA" },
  { name: "Pike County", fips: "13231", stateCode: "GA" },
  { name: "Polk County", fips: "13233", stateCode: "GA" },
  { name: "Pulaski County", fips: "13235", stateCode: "GA" },
  { name: "Putnam County", fips: "13237", stateCode: "GA" },
  { name: "Quitman County", fips: "13239", stateCode: "GA" },
  { name: "Rabun County", fips: "13241", stateCode: "GA" },
  { name: "Randolph County", fips: "13243", stateCode: "GA" },
  { name: "Richmond County", fips: "13245", stateCode: "GA" },
  { name: "Rockdale County", fips: "13247", stateCode: "GA" },
  { name: "Schley County", fips: "13249", stateCode: "GA" },
  { name: "Screven County", fips: "13251", stateCode: "GA" },
  { name: "Seminole County", fips: "13253", stateCode: "GA" },
  { name: "Spalding County", fips: "13255", stateCode: "GA" },
  { name: "Stephens County", fips: "13257", stateCode: "GA" },
  { name: "Stewart County", fips: "13259", stateCode: "GA" },
  { name: "Sumter County", fips: "13261", stateCode: "GA" },
  { name: "Talbot County", fips: "13263", stateCode: "GA" },
  { name: "Taliaferro County", fips: "13265", stateCode: "GA" },
  { name: "Tattnall County", fips: "13267", stateCode: "GA" },
  { name: "Taylor County", fips: "13269", stateCode: "GA" },
  { name: "Telfair County", fips: "13271", stateCode: "GA" },
  { name: "Terrell County", fips: "13273", stateCode: "GA" },
  { name: "Thomas County", fips: "13275", stateCode: "GA" },
  { name: "Tift County", fips: "13277", stateCode: "GA" },
  { name: "Toombs County", fips: "13279", stateCode: "GA" },
  { name: "Towns County", fips: "13281", stateCode: "GA" },
  { name: "Treutlen County", fips: "13283", stateCode: "GA" },
  { name: "Troup County", fips: "13285", stateCode: "GA" },
  { name: "Turner County", fips: "13287", stateCode: "GA" },
  { name: "Twiggs County", fips: "13289", stateCode: "GA" },
  { name: "Union County", fips: "13291", stateCode: "GA" },
  { name: "Upson County", fips: "13293", stateCode: "GA" },
  { name: "Walker County", fips: "13295", stateCode: "GA" },
  { name: "Walton County", fips: "13297", stateCode: "GA" },
  { name: "Ware County", fips: "13299", stateCode: "GA" },
  { name: "Warren County", fips: "13301", stateCode: "GA" },
  { name: "Washington County", fips: "13303", stateCode: "GA" },
  { name: "Wayne County", fips: "13305", stateCode: "GA" },
  { name: "Webster County", fips: "13307", stateCode: "GA" },
  { name: "Wheeler County", fips: "13309", stateCode: "GA" },
  { name: "White County", fips: "13311", stateCode: "GA" },
  { name: "Whitfield County", fips: "13313", stateCode: "GA" },
  { name: "Wilcox County", fips: "13315", stateCode: "GA" },
  { name: "Wilkes County", fips: "13317", stateCode: "GA" },
  { name: "Wilkinson County", fips: "13319", stateCode: "GA" },
  { name: "Worth County", fips: "13321", stateCode: "GA" }
];

export async function seedGeorgiaCounties() {
  try {
    console.log("Starting Georgia county seeding...");
    
    // Remove existing Georgia counties to avoid duplicates
    await db.delete(counties).where(eq(counties.stateCode, 'GA'));
    console.log("Cleared existing Georgia county data");

    // Insert Georgia counties in batches
    const batchSize = 50;
    for (let i = 0; i < georgiaCounties.length; i += batchSize) {
      const batch = georgiaCounties.slice(i, i + batchSize);
      await db.insert(counties).values(batch);
      console.log(`Inserted Georgia batch ${Math.floor(i / batchSize) + 1}, counties ${i + 1}-${Math.min(i + batchSize, georgiaCounties.length)}`);
    }

    console.log(`Successfully seeded ${georgiaCounties.length} Georgia counties`);
    
    // Verify the data
    const count = await db.select().from(counties).where(eq(counties.stateCode, 'GA'));
    console.log(`Total Georgia counties in database: ${count.length}`);
    
    return count.length;
  } catch (error) {
    console.error("Error seeding Georgia counties:", error);
    throw error;
  }
}

// Run the seeding function immediately
seedGeorgiaCounties()
  .then(() => {
    console.log("Georgia county seeding completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Georgia county seeding failed:", error);
    process.exit(1);
  });
