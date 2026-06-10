const mongoose = require("mongoose");
const PossibleLoanCharges = require("./src/models/PossibleLoanCharges");

async function checkLoanCharges() {
  try {
    await mongoose.connect("mongodb://localhost:27017/miracore");
    const charges = await PossibleLoanCharges.find({
      request: { $regex: "11139834", $options: "i" }
    });
    console.log(JSON.stringify(charges, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

checkLoanCharges();
