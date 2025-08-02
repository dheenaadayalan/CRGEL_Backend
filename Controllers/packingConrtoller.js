import mongoose from "mongoose";

/**
 * Calculate how many boxes of each type you can fill, size‑wise,
 * minimizing leftovers and enforcing that mixed boxes (Option1+Option2)
 * do not exceed 30% of total packed boxes, and ensuring normals ≥70%.
 */
function calculatePacking(orderQtyBySize, cuttingQtyBySize) {
  const results = {};

  for (const size of Object.keys(orderQtyBySize)) {
    const availStart = { ...cuttingQtyBySize[size] };
    const colours = Object.keys(orderQtyBySize[size] || {});
    const nonBlack = colours.filter(c => c.toLowerCase() !== 'black');
    const blackKey = colours.find(c => c.toLowerCase() === 'black');

    // can we pack one box of given type under availability & 30% cap?
    function canPack(type, avail, counts) {
      const { normal, option1, option2 } = counts;
      const fallback = option1 + option2;
      const totalAfter = normal + fallback + 1;
      const fallbackAfter = fallback + (type === 'normal' ? 0 : 1);
      // fallback boxes ≤30% of total
      if (fallbackAfter > Math.floor(totalAfter * 0.3)) return false;
      // check resources
      if (type === 'normal') {
        if (!blackKey || (avail[blackKey] || 0) < 3) return false;
        if (!nonBlack.every(c => (avail[c] || 0) >= 1)) return false;
        return true;
      }
      if (type === 'option1') {
        if (!blackKey || (avail[blackKey] || 0) < 3) return false;
        if (!nonBlack.some(c => (avail[c] || 0) >= 2)) return false;
        if (nonBlack.filter(c => (avail[c] || 0) >= 1).length < 4) return false;
        return true;
      }
      // option2
      if (!blackKey || (avail[blackKey] || 0) < 2) return false;
      if (!nonBlack.every(c => (avail[c] || 0) >= 1)) return false;
      if (!nonBlack.some(c => (avail[c] || 0) >= 2)) return false;
      return true;
    }

    // deduct resources for one box of given type
    function doPack(type, avail, counts) {
      if (type === 'normal') {
        avail[blackKey] -= 3;
        nonBlack.forEach(c => (avail[c] -= 1));
        counts.normal++;
      } else if (type === 'option1') {
        avail[blackKey] -= 3;
        const dbl = nonBlack.filter(c => avail[c] >= 2)
          .reduce((a, b) => (avail[b] > avail[a] ? b : a));
        avail[dbl] -= 2;
        nonBlack.filter(c => c !== dbl && avail[c] >= 1)
          .sort((a, b) => avail[b] - avail[a])
          .slice(0, 3)
          .forEach(c => (avail[c] -= 1));
        counts.option1++;
      } else {
        avail[blackKey] -= 2;
        const dbl = nonBlack.filter(c => avail[c] >= 2)
          .reduce((a, b) => (avail[b] > avail[a] ? b : a));
        avail[dbl] -= 2;
        nonBlack.filter(c => c !== dbl).forEach(c => (avail[c] -= 1));
        counts.option2++;
      }
    }

    // evaluate all ordering sequences to minimize leftovers
    const sequences = [
      ['normal','option1','option2'],
      ['normal','option2','option1'],
      ['option1','normal','option2'],
      ['option1','option2','normal'],
      ['option2','normal','option1'],
      ['option2','option1','normal']
    ];

    let best = { total: -1, leftoversSum: Infinity, counts: null, leftovers: null };

    for (const seq of sequences) {
      const avail = { ...availStart };
      const counts = { normal: 0, option1: 0, option2: 0 };
      let progress = true;
      while (progress) {
        progress = false;
        for (const type of seq) {
          if (canPack(type, avail, counts)) {
            doPack(type, avail, counts);
            progress = true;
          }
        }
      }
      const totalBoxes = counts.normal + counts.option1 + counts.option2;
      const leftoversSum = Object.values(avail).reduce((a, b) => a + b, 0);
      if (
        totalBoxes > best.total ||
        (totalBoxes === best.total && leftoversSum < best.leftoversSum)
      ) {
        best = { total: totalBoxes, leftoversSum, counts, leftovers: { ...avail } };
      }
    }

    // ensure normals ≥70% of packed
    const { normal, option1, option2 } = best.counts;
    const fallbackCount = option1 + option2;
    const packedTotal = normal + fallbackCount;
    if (packedTotal > 0 && normal < Math.ceil(packedTotal * 0.7)) {
      // recalc normals only
      const avail = { ...availStart };
      const maxByBlack = blackKey ? Math.floor((avail[blackKey] || 0) / 3) : 0;
      const maxByColor = nonBlack.length
        ? Math.min(...nonBlack.map(c => Math.floor((avail[c] || 0) / 1)))
        : 0;
      const onlyNormal = Math.min(maxByBlack, maxByColor);
      if (blackKey) avail[blackKey] -= onlyNormal * 3;
      nonBlack.forEach(c => (avail[c] -= onlyNormal));
      results[size] = { normalBoxes: onlyNormal, option1Boxes: 0, option2Boxes: 0, leftovers: { ...avail } };
    } else {
      results[size] = {
        normalBoxes: best.counts.normal,
        option1Boxes: best.counts.option1,
        option2Boxes: best.counts.option2,
        leftovers: best.leftovers
      };
    }
  }

  return results;
}

// Express controller
export const packingInfo = async (req, res) => {
  try {
    const { orderQty, cuttingQty } = req.body;
    if (!orderQty || !cuttingQty) {
      return res.status(400).json({ message: 'orderQty and cuttingQty required' });
    }
    const packingBySize = calculatePacking(orderQty, cuttingQty);
    return res.json({ packingBySize });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
};






// import mongoose from "mongoose";

// /**
//  * Calculate how many boxes of each type you can fill, size‑wise,
//  * minimizing leftovers and enforcing that mixed (Option1+Option2)
//  * do not exceed 30% of total packed boxes.
//  * @param {object} orderQtyBySize   mapping size -> { color -> qty ordered }
//  * @param {object} cuttingQtyBySize mapping size -> { color -> qty available }
//  * @returns {object} mapping size -> { normalBoxes, option1Boxes, option2Boxes, leftovers }
//  */
// function calculatePacking(orderQtyBySize, cuttingQtyBySize) {
//   const results = {};

//   for (const size of Object.keys(orderQtyBySize)) {
//     const availStart = { ...cuttingQtyBySize[size] };
//     const colours = Object.keys(orderQtyBySize[size] || {});
//     const nonBlack = colours.filter(c => c.toLowerCase() !== 'black');
//     const blackKey = colours.find(c => c.toLowerCase() === 'black');

//     // helper to check can pack one box of a given type
//     function canPackType(type, avail, counts) {
//       const { normal, option1, option2 } = counts;
//       // fallback count = option1+option2
//       const fallback = option1 + option2;
//       const totalAfter = normal + fallback + 1;
//       const fallbackAfter = fallback + (type === 'normal' ? 0 : 1);
//       // enforce fallback cap
//       if (fallbackAfter > Math.floor(totalAfter * 0.3)) return false;
//       // resource checks
//       if (type === 'normal') {
//         if (!blackKey || (avail[blackKey] || 0) < 3) return false;
//         if (!nonBlack.every(c => (avail[c] || 0) >= 1)) return false;
//         return true;
//       }
//       if (type === 'option1') {
//         if (!blackKey || (avail[blackKey] || 0) < 3) return false;
//         if (!nonBlack.some(c => (avail[c] || 0) >= 2)) return false;
//         if (nonBlack.filter(c => (avail[c] || 0) >= 1).length < 4) return false;
//         return true;
//       }
//       // option2
//       if (!blackKey || (avail[blackKey] || 0) < 2) return false;
//       if (!nonBlack.every(c => (avail[c] || 0) >= 1)) return false;
//       if (!nonBlack.some(c => (avail[c] || 0) >= 2)) return false;
//       return true;
//     }

//     // consume one box of a given type
//     function doPackType(type, avail, counts) {
//       if (type === 'normal') {
//         avail[blackKey] -= 3;
//         nonBlack.forEach(c => (avail[c] -= 1));
//         counts.normal++;
//       } else if (type === 'option1') {
//         avail[blackKey] -= 3;
//         // pick highest avail for double
//         const dbl = nonBlack.filter(c => avail[c] >= 2)
//           .reduce((a, b) => (avail[b] > avail[a] ? b : a));
//         avail[dbl] -= 2;
//         // pick top three for singles
//         nonBlack.filter(c => c !== dbl && avail[c] >= 1)
//           .sort((a, b) => avail[b] - avail[a])
//           .slice(0, 3)
//           .forEach(c => (avail[c] -= 1));
//         counts.option1++;
//       } else {
//         // option2
//         avail[blackKey] -= 2;
//         const dbl = nonBlack.filter(c => avail[c] >= 2)
//           .reduce((a, b) => (avail[b] > avail[a] ? b : a));
//         avail[dbl] -= 2;
//         nonBlack.filter(c => c !== dbl)
//           .forEach(c => (avail[c] -= 1));
//         counts.option2++;
//       }
//     }

//     // all sequences of types
//     const sequences = [
//       ['normal','option1','option2'],
//       ['normal','option2','option1'],
//       ['option1','normal','option2'],
//       ['option1','option2','normal'],
//       ['option2','normal','option1'],
//       ['option2','option1','normal']
//     ];

//     let best = { total: -1, leftovers: null, counts: null };

//     for (const seq of sequences) {
//       const avail = { ...availStart };
//       const counts = { normal: 0, option1: 0, option2: 0 };
//       let progress = true;
//       while (progress) {
//         progress = false;
//         for (const type of seq) {
//           if (canPackType(type, avail, counts)) {
//             doPackType(type, avail, counts);
//             progress = true;
//           }
//         }
//       }
//       const totalBoxes = counts.normal + counts.option1 + counts.option2;
//       const leftoverSum = Object.values(avail).reduce((a,b)=>a+b,0);
//       if (
//         totalBoxes > best.total ||
//         (totalBoxes === best.total && leftoverSum < Object.values(best.leftovers||{}).reduce((a,b)=>a+b,Infinity))
//       ) {
//         best = { total: totalBoxes, leftovers: { ...avail }, counts: { ...counts } };
//       }
//     }

//     results[size] = {
//       normalBoxes: best.counts.normal,
//       option1Boxes: best.counts.option1,
//       option2Boxes: best.counts.option2,
//       leftovers: best.leftovers
//     };
//   }
//   return results;
// }

// // Express controller
// export const packingInfo = async (req, res) => {
//   try {
//     const { orderQty, cuttingQty } = req.body;
//     if (!orderQty || !cuttingQty) {
//       return res.status(400).json({ message: 'orderQty and cuttingQty required' });
//     }
//     const packingBySize = calculatePacking(orderQty, cuttingQty);
//     return res.json({ packingBySize });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: 'Server error.' });
//   }
// };