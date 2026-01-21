import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function quickFix() {
  console.log('⚡ Quick-fixing market 566227...\n');
  
  try {
    // Update market with correct eventSlug
    const result = await prisma.market.update({
      where: { id: '566227' },
      data: { 
        eventSlug: 'la-liga-winner-114',
        slug: 'will-real-madrid-win-the-2025-26-la-liga'
      }
    });
    
    console.log('✅ SUCCESS! Market updated:');
    console.log(`   ID: ${result.id}`);
    console.log(`   Question: ${result.question}`);
    console.log(`   Event Slug: ${result.eventSlug} ✨`);
    console.log(`   Slug: ${result.slug}`);
    console.log('\n🎉 DONE! Refresh Alpha Markets page now!\n');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

quickFix();
