import { db } from '../server/db.js';
import { counties } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// Pennsylvania Counties - All 67 counties
const pennsylvaniaCounties = [
  { name: "Adams County", fips: "42001", stateCode: "PA" },
  { name: "Allegheny County", fips: "42003", stateCode: "PA" },
  { name: "Armstrong County", fips: "42005", stateCode: "PA" },
  { name: "Beaver County", fips: "42007", stateCode: "PA" },
  { name: "Bedford County", fips: "42009", stateCode: "PA" },
  { name: "Berks County", fips: "42011", stateCode: "PA" },
  { name: "Blair County", fips: "42013", stateCode: "PA" },
  { name: "Bradford County", fips: "42015", stateCode: "PA" },
  { name: "Bucks County", fips: "42017", stateCode: "PA" },
  { name: "Butler County", fips: "42019", stateCode: "PA" },
  { name: "Cambria County", fips: "42021", stateCode: "PA" },
  { name: "Cameron County", fips: "42023", stateCode: "PA" },
  { name: "Carbon County", fips: "42025", stateCode: "PA" },
  { name: "Centre County", fips: "42027", stateCode: "PA" },
  { name: "Chester County", fips: "42029", stateCode: "PA" },
  { name: "Clarion County", fips: "42031", stateCode: "PA" },
  { name: "Clearfield County", fips: "42033", stateCode: "PA" },
  { name: "Clinton County", fips: "42035", stateCode: "PA" },
  { name: "Columbia County", fips: "42037", stateCode: "PA" },
  { name: "Crawford County", fips: "42039", stateCode: "PA" },
  { name: "Cumberland County", fips: "42041", stateCode: "PA" },
  { name: "Dauphin County", fips: "42043", stateCode: "PA" },
  { name: "Delaware County", fips: "42045", stateCode: "PA" },
  { name: "Elk County", fips: "42047", stateCode: "PA" },
  { name: "Erie County", fips: "42049", stateCode: "PA" },
  { name: "Fayette County", fips: "42051", stateCode: "PA" },
  { name: "Forest County", fips: "42053", stateCode: "PA" },
  { name: "Franklin County", fips: "42055", stateCode: "PA" },
  { name: "Fulton County", fips: "42057", stateCode: "PA" },
  { name: "Greene County", fips: "42059", stateCode: "PA" },
  { name: "Huntingdon County", fips: "42061", stateCode: "PA" },
  { name: "Indiana County", fips: "42063", stateCode: "PA" },
  { name: "Jefferson County", fips: "42065", stateCode: "PA" },
  { name: "Juniata County", fips: "42067", stateCode: "PA" },
  { name: "Lackawanna County", fips: "42069", stateCode: "PA" },
  { name: "Lancaster County", fips: "42071", stateCode: "PA" },
  { name: "Lawrence County", fips: "42073", stateCode: "PA" },
  { name: "Lebanon County", fips: "42075", stateCode: "PA" },
  { name: "Lehigh County", fips: "42077", stateCode: "PA" },
  { name: "Luzerne County", fips: "42079", stateCode: "PA" },
  { name: "Lycoming County", fips: "42081", stateCode: "PA" },
  { name: "McKean County", fips: "42083", stateCode: "PA" },
  { name: "Mercer County", fips: "42085", stateCode: "PA" },
  { name: "Mifflin County", fips: "42087", stateCode: "PA" },
  { name: "Monroe County", fips: "42089", stateCode: "PA" },
  { name: "Montgomery County", fips: "42091", stateCode: "PA" },
  { name: "Montour County", fips: "42093", stateCode: "PA" },
  { name: "Northampton County", fips: "42095", stateCode: "PA" },
  { name: "Northumberland County", fips: "42097", stateCode: "PA" },
  { name: "Perry County", fips: "42099", stateCode: "PA" },
  { name: "Philadelphia County", fips: "42101", stateCode: "PA" },
  { name: "Pike County", fips: "42103", stateCode: "PA" },
  { name: "Potter County", fips: "42105", stateCode: "PA" },
  { name: "Schuylkill County", fips: "42107", stateCode: "PA" },
  { name: "Snyder County", fips: "42109", stateCode: "PA" },
  { name: "Somerset County", fips: "42111", stateCode: "PA" },
  { name: "Sullivan County", fips: "42113", stateCode: "PA" },
  { name: "Susquehanna County", fips: "42115", stateCode: "PA" },
  { name: "Tioga County", fips: "42117", stateCode: "PA" },
  { name: "Union County", fips: "42119", stateCode: "PA" },
  { name: "Venango County", fips: "42121", stateCode: "PA" },
  { name: "Warren County", fips: "42123", stateCode: "PA" },
  { name: "Washington County", fips: "42125", stateCode: "PA" },
  { name: "Wayne County", fips: "42127", stateCode: "PA" },
  { name: "Westmoreland County", fips: "42129", stateCode: "PA" },
  { name: "Wyoming County", fips: "42131", stateCode: "PA" },
  { name: "York County", fips: "42133", stateCode: "PA" }
];

export async function seedPennsylvaniaCounties() {
  try {
    console.log("Starting Pennsylvania county seeding...");
    
    await db.delete(counties).where(eq(counties.stateCode, 'PA'));
    await db.insert(counties).values(pennsylvaniaCounties);
    
    const count = await db.select().from(counties).where(eq(counties.stateCode, 'PA'));
    console.log(`Successfully seeded ${count.length} Pennsylvania counties`);
    
    return count.length;
  } catch (error) {
    console.error("Error seeding Pennsylvania counties:", error);
    throw error;
  }
}

seedPennsylvaniaCounties()
  .then(() => {
    console.log("Pennsylvania county seeding completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Pennsylvania county seeding failed:", error);
    process.exit(1);
  });