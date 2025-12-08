import { db } from "../src/db/drizzle-mock";
import { counties } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// Michigan Counties - All 83 counties
const michiganCounties = [
  { name: "Alcona County", fips: "26001", stateCode: "MI" },
  { name: "Alger County", fips: "26003", stateCode: "MI" },
  { name: "Allegan County", fips: "26005", stateCode: "MI" },
  { name: "Alpena County", fips: "26007", stateCode: "MI" },
  { name: "Antrim County", fips: "26009", stateCode: "MI" },
  { name: "Arenac County", fips: "26011", stateCode: "MI" },
  { name: "Baraga County", fips: "26013", stateCode: "MI" },
  { name: "Barry County", fips: "26015", stateCode: "MI" },
  { name: "Bay County", fips: "26017", stateCode: "MI" },
  { name: "Benzie County", fips: "26019", stateCode: "MI" },
  { name: "Berrien County", fips: "26021", stateCode: "MI" },
  { name: "Branch County", fips: "26023", stateCode: "MI" },
  { name: "Calhoun County", fips: "26025", stateCode: "MI" },
  { name: "Cass County", fips: "26027", stateCode: "MI" },
  { name: "Charlevoix County", fips: "26029", stateCode: "MI" },
  { name: "Cheboygan County", fips: "26031", stateCode: "MI" },
  { name: "Chippewa County", fips: "26033", stateCode: "MI" },
  { name: "Clare County", fips: "26035", stateCode: "MI" },
  { name: "Clinton County", fips: "26037", stateCode: "MI" },
  { name: "Crawford County", fips: "26039", stateCode: "MI" },
  { name: "Delta County", fips: "26041", stateCode: "MI" },
  { name: "Dickinson County", fips: "26043", stateCode: "MI" },
  { name: "Eaton County", fips: "26045", stateCode: "MI" },
  { name: "Emmet County", fips: "26047", stateCode: "MI" },
  { name: "Genesee County", fips: "26049", stateCode: "MI" },
  { name: "Gladwin County", fips: "26051", stateCode: "MI" },
  { name: "Gogebic County", fips: "26053", stateCode: "MI" },
  { name: "Grand Traverse County", fips: "26055", stateCode: "MI" },
  { name: "Gratiot County", fips: "26057", stateCode: "MI" },
  { name: "Hillsdale County", fips: "26059", stateCode: "MI" },
  { name: "Houghton County", fips: "26061", stateCode: "MI" },
  { name: "Huron County", fips: "26063", stateCode: "MI" },
  { name: "Ingham County", fips: "26065", stateCode: "MI" },
  { name: "Ionia County", fips: "26067", stateCode: "MI" },
  { name: "Iosco County", fips: "26069", stateCode: "MI" },
  { name: "Iron County", fips: "26071", stateCode: "MI" },
  { name: "Isabella County", fips: "26073", stateCode: "MI" },
  { name: "Jackson County", fips: "26075", stateCode: "MI" },
  { name: "Kalamazoo County", fips: "26077", stateCode: "MI" },
  { name: "Kalkaska County", fips: "26079", stateCode: "MI" },
  { name: "Kent County", fips: "26081", stateCode: "MI" },
  { name: "Keweenaw County", fips: "26083", stateCode: "MI" },
  { name: "Lake County", fips: "26085", stateCode: "MI" },
  { name: "Lapeer County", fips: "26087", stateCode: "MI" },
  { name: "Leelanau County", fips: "26089", stateCode: "MI" },
  { name: "Lenawee County", fips: "26091", stateCode: "MI" },
  { name: "Livingston County", fips: "26093", stateCode: "MI" },
  { name: "Luce County", fips: "26095", stateCode: "MI" },
  { name: "Mackinac County", fips: "26097", stateCode: "MI" },
  { name: "Macomb County", fips: "26099", stateCode: "MI" },
  { name: "Manistee County", fips: "26101", stateCode: "MI" },
  { name: "Marquette County", fips: "26103", stateCode: "MI" },
  { name: "Mason County", fips: "26105", stateCode: "MI" },
  { name: "Mecosta County", fips: "26107", stateCode: "MI" },
  { name: "Menominee County", fips: "26109", stateCode: "MI" },
  { name: "Midland County", fips: "26111", stateCode: "MI" },
  { name: "Missaukee County", fips: "26113", stateCode: "MI" },
  { name: "Monroe County", fips: "26115", stateCode: "MI" },
  { name: "Montcalm County", fips: "26117", stateCode: "MI" },
  { name: "Montmorency County", fips: "26119", stateCode: "MI" },
  { name: "Muskegon County", fips: "26121", stateCode: "MI" },
  { name: "Newaygo County", fips: "26123", stateCode: "MI" },
  { name: "Oakland County", fips: "26125", stateCode: "MI" },
  { name: "Oceana County", fips: "26127", stateCode: "MI" },
  { name: "Ogemaw County", fips: "26129", stateCode: "MI" },
  { name: "Ontonagon County", fips: "26131", stateCode: "MI" },
  { name: "Osceola County", fips: "26133", stateCode: "MI" },
  { name: "Oscoda County", fips: "26135", stateCode: "MI" },
  { name: "Otsego County", fips: "26137", stateCode: "MI" },
  { name: "Ottawa County", fips: "26139", stateCode: "MI" },
  { name: "Presque Isle County", fips: "26141", stateCode: "MI" },
  { name: "Roscommon County", fips: "26143", stateCode: "MI" },
  { name: "Saginaw County", fips: "26145", stateCode: "MI" },
  { name: "St. Clair County", fips: "26147", stateCode: "MI" },
  { name: "St. Joseph County", fips: "26149", stateCode: "MI" },
  { name: "Sanilac County", fips: "26151", stateCode: "MI" },
  { name: "Schoolcraft County", fips: "26153", stateCode: "MI" },
  { name: "Shiawassee County", fips: "26155", stateCode: "MI" },
  { name: "Tuscola County", fips: "26157", stateCode: "MI" },
  { name: "Van Buren County", fips: "26159", stateCode: "MI" },
  { name: "Washtenaw County", fips: "26161", stateCode: "MI" },
  { name: "Wayne County", fips: "26163", stateCode: "MI" },
  { name: "Wexford County", fips: "26165", stateCode: "MI" }
];

export async function seedMichiganCounties() {
  try {
    console.log("Starting Michigan county seeding...");
    
    await db.delete(counties).where(eq(counties.stateCode, 'MI'));
    await db.insert(counties).values(michiganCounties);
    
    const count = await db.select().from(counties).where(eq(counties.stateCode, 'MI'));
    console.log(`Successfully seeded ${count.length} Michigan counties`);
    
    return count.length;
  } catch (error) {
    console.error("Error seeding Michigan counties:", error);
    throw error;
  }
}

seedMichiganCounties()
  .then(() => {
    console.log("Michigan county seeding completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Michigan county seeding failed:", error);
    process.exit(1);
  });
