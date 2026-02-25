const BASE_URL = 'http://localhost:3001/api/server-proxy';
const PAGE_SIZE = 100;

async function fetchPage(pageNumber) {
  const url = `${BASE_URL}?domain=www.dentons.com&service=people&pageSize=${PAGE_SIZE}&pageNumber=${pageNumber}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} on page ${pageNumber}`);
  return res.json();
}

async function main() {
  let pageNumber = 1;
  let totalScanned = 0;
  let withJobTitle = 0;
  let withoutJobTitle = 0;
  const namesWithout = [];

  const firstPage = await fetchPage(pageNumber);
  const totalResult = firstPage.totalResult;
  const totalPages = Math.ceil(totalResult / PAGE_SIZE);

  console.log(`Total results from API: ${totalResult}`);
  console.log(`Total pages to fetch: ${totalPages}`);

  let persons = firstPage.persons || [];
  while (true) {
    for (const person of persons) {
      totalScanned++;
      const jt = person.jobTitle;
      if (!jt || (typeof jt === 'string' && jt.trim() === '')) {
        withoutJobTitle++;
        namesWithout.push(person.firstName || '(no name)');
      } else {
        withJobTitle++;
      }
    }

    if (pageNumber % 10 === 0) {
      console.log(`  Page ${pageNumber}/${totalPages} - scanned ${totalScanned}`);
    }

    pageNumber++;
    if (pageNumber > totalPages) break;

    const page = await fetchPage(pageNumber);
    persons = page.persons || [];
  }

  console.log('');
  console.log('=== FINAL RESULTS ===');
  console.log(`Total scanned:    ${totalScanned}`);
  console.log(`With jobTitle:    ${withJobTitle} (${((withJobTitle / totalScanned) * 100).toFixed(2)}%)`);
  console.log(`Without jobTitle: ${withoutJobTitle} (${((withoutJobTitle / totalScanned) * 100).toFixed(2)}%)`);

  if (namesWithout.length > 0 && namesWithout.length <= 100) {
    console.log('');
    console.log('Names without jobTitle:');
    namesWithout.forEach((n, i) => console.log(`  ${i + 1}. ${n}`));
  } else if (namesWithout.length > 100) {
    console.log('');
    console.log('First 100 names without jobTitle:');
    namesWithout.slice(0, 100).forEach((n, i) => console.log(`  ${i + 1}. ${n}`));
    console.log(`  ... and ${namesWithout.length - 100} more`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
