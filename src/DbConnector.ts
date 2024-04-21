import * as dotenv from "dotenv"
import * as fs from "fs"
dotenv.config({ path: "./database.env" })

import { Client } from "pg";

export const client = new Client()

client.connect()


export async function prepareTest(functionName: string, preparation?: { schema: string, table: string, values: any[][] }[]) {
	let query = "SELECT * FROM pg_proc WHERE proname = ($1);";
	let values: string[] = [functionName];
	let functionDefinitionReturn = await client.query(query, values)
	// console.log(res.rows[0])
	let src: string = functionDefinitionReturn.rows[0].prosrc;

	let nextSearchStartIndex = 0
	while (true) {
		let insertIndex = src.indexOf("INSERT INTO", nextSearchStartIndex)
		if (insertIndex < 0) break
		insertIndex += ("INSERT INTO ".length)

		nextSearchStartIndex = src.indexOf(";", insertIndex) + 1;


		const foundName: string = src.substring(insertIndex).split(" ").filter((item) => item != "")[0]
		const tableAndSchemaName: string = foundName.split("(")[0];
		// console.log("table and schema name:", tableAndSchemaName)

		const separatedTableAndSchema: string[] = tableAndSchemaName.split(".")
		const tableName: string = separatedTableAndSchema[separatedTableAndSchema.length - 1]

		let schemaName = "public"
		if (separatedTableAndSchema.length === 2) {
			schemaName = separatedTableAndSchema[0]
		}
		console.log("tableName without schema:", tableName)
		console.log("schema name:", schemaName)

		// create table clone
		let query = "SELECT * from information_schema.columns WHERE table_schema = ($1) AND table_name = ($2);"
		let values: any[] = [schemaName, tableName];
		let tableInformationReturn = await client.query(query, values);
		if (tableInformationReturn.rows.length) {
			if (!foundName.includes("(")) {
				src = src.replace(` ${foundName} `, ` ${schemaName}.test_${tableName} `);
			} else {
				src = src.replace(` ${foundName} `, ` ${schemaName}.test_${tableName}(${foundName.split("(")[1]} `);
			}
			let query = `CREATE TABLE ${schemaName}.test_${tableName} as (select * from ${schemaName}.${tableName}) with no data;`
			let values: any[] = [];
			await client.query(query, values);
		}

	}
	//-----------
	//preparation
	//
	await prepareInput(preparation);

	//-----------

	const shadowFunctionSourceText = await craftShadowFunction(functionName, functionDefinitionReturn, src)

	fs.writeFileSync(__dirname + "/blubby.txte", shadowFunctionSourceText)
}

async function prepareInput(preparation?: any) {
	if (preparation) {
		for (let i = 0; i < preparation.length; i++) {
			let query = `INSERT INTO ${preparation[i].schema}.test_${preparation[i].table} VALUES (`
			for (let j = 0; j < preparation[i].values[0].length; j++) {
				if (j === 0) {
					query += `($${j + 1}) `;
				} else {
					query += `, ($${j + 1}) `
				}
			}
			query += ");";

			for (const valuePair of preparation[i].values) {
				const values = valuePair
				console.log("values for preparation:", values)
				console.log("query:", query);
				await client.query(query, values);
			}
		}
	}
}

async function craftShadowFunction(functionName: string, functionDefinitionReturn: any, functionSourceText: string) {
	let returnType: number | string = functionDefinitionReturn.rows[0].prorettype
	let inputTypes: number[] | string[] = functionDefinitionReturn.rows[0].proargtypes.match(/\d+/g).map((inString: string) => { return parseInt(inString) })
	const inputArgs: string[] = functionDefinitionReturn.rows[0].proargnames

	const typeSet = Array.from(new Set([returnType, ...inputTypes]))

	const typeMap = new Map<number, string>()

	const query = "SELECT typname, oid FROM pg_type where oid IN ($1);"
	let allUsedTypesReturn = await client.query(query, typeSet);

	for (let i = 0; i < allUsedTypesReturn.rows.length; i++) {
		typeMap.set(allUsedTypesReturn.rows[i].oid, allUsedTypesReturn.rows[i].typname)
	}


	returnType = typeMap.get(returnType as number)!
	inputTypes = inputTypes.map((item) => { return typeMap.get(item as number)! });

	let argsString = ""
	for (let i = 0; i < inputArgs.length; i++) {
		if (i === 0) {
			argsString += `${inputArgs[i]} ${inputTypes[i]}`

		} else {
			argsString += `,${inputArgs[i]} ${inputTypes[i]}`
		};
	}


	const prefix = `CREATE OR REPLACE FUNCTION test_${functionName} (${argsString})\n RETURNS ${returnType}\n LANGUAGE plpgsql\nAS $$\n`;
	const postfix = "\n$$;"

	return prefix + functionSourceText + postfix
}


// const prepData: { schema: string, table: string, values: any[][] }[] = [{ schema: "public", table: "mytable", values: [[1, "someTestValue"], [1411, "someOtherValue"]] }, { schema: "schemaaa", table: "other_table", values: [[69, "noice"]] }];
// prepareTest("add", prepData)
