import { ContentStore } from "../storage/contentStore";
import { ContentRelationship } from "../types/storage";

// Add sample content to storage for testing
async function addSampleContent() {
  const store = ContentStore.getInstance();
  const currentDate = new Date();
  const sampleContent = [
    {
      id: crypto.randomUUID(),
      url: "https://tech.economictimes.indiatimes.com/article/ai-revolution",
      title: "AI Revolution in Indian Tech Industry",
      content:
        "The Indian technology sector is witnessing a remarkable transformation through artificial intelligence. Major IT hubs like Bangalore, Hyderabad, and Pune are becoming epicenters of AI innovation. Companies like TCS, Infosys, and Wipro are leading the charge in implementing AI solutions across various sectors...",
      captureMethod: "manual" as const,
      timestamp: new Date(),
      metadata: {
        author: "Rahul Sharma",
        publishDate: new Date(),
        pageType: "article" as const,
        readingTime: 8,
        language: "en",
        keywords: [
          "AI",
          "Indian Tech",
          "Digital Transformation",
          "IT Industry",
        ],
        wordCount: 800,
        imageCount: 3,
        linkCount: 6,
      },
      importance: 5,
      timesAccessed: 12,
      concepts: ["AI", "Digital Transformation", "Indian Tech Industry"],
      category: "technology",
    },
    {
      id: crypto.randomUUID(),
      url: "https://healthyindianrecipes.com/modern-fusion",
      title: "Modern Indian Fusion Cuisine: A Culinary Journey",
      content:
        "Exploring the fascinating blend of traditional Indian flavors with modern cooking techniques. From molecular gastronomy meets masala dosa to avocado tikka masala, discover how chefs are revolutionizing Indian cuisine...",
      captureMethod: "manual" as const,
      timestamp: new Date(currentDate.getTime() - 2 * 86400000),
      metadata: {
        author: "Chef Anjali Kumar",
        publishDate: new Date(currentDate.getTime() - 2 * 86400000),
        pageType: "article",
        readingTime: 15,
        language: "en",
        keywords: [
          "Indian Cuisine",
          "Fusion Food",
          "Modern Cooking",
          "Culinary Arts",
        ],
        wordCount: 1200,
        imageCount: 8,
        linkCount: 4,
      },
      importance: 4,
      timesAccessed: 8,
      concepts: ["Indian Cuisine", "Culinary Innovation", "Food Fusion"],
      category: "food",
    },
    {
      id: crypto.randomUUID(),
      url: "https://sustainableindia.org/green-initiatives",
      title: "Sustainable Development Initiatives in India",
      content:
        "India's commitment to renewable energy and sustainable development is showing promising results. From solar parks in Rajasthan to wind farms in Tamil Nadu, the country is leading various green initiatives...",
      captureMethod: "automatic" as const,
      timestamp: new Date(currentDate.getTime() - 3 * 86400000),
      metadata: {
        author: "Dr. Sunita Rao",
        publishDate: new Date(currentDate.getTime() - 3 * 86400000),
        pageType: "documentation" as const,
        readingTime: 20,
        language: "en",
        keywords: [
          "Sustainability",
          "Renewable Energy",
          "Green Initiative",
          "Climate Action",
        ],
        wordCount: 2500,
        imageCount: 6,
        linkCount: 12,
      },
      importance: 5,
      timesAccessed: 15,
      concepts: [
        "Renewable Energy",
        "Sustainable Development",
        "Environmental Conservation",
      ],
      category: "environment",
    },
    {
      id: crypto.randomUUID(),
      url: "https://digital-art-india.com/ai-revolution",
      title: "AI in Indian Digital Art: A New Renaissance",
      content:
        "Artificial intelligence is revolutionizing the Indian digital art scene. From AI-generated Madhubani paintings to deep learning-enhanced contemporary art, explore how technology is reshaping artistic expression...",
      captureMethod: "manual" as const,
      timestamp: new Date(currentDate.getTime() - 4 * 86400000),
      metadata: {
        author: "Vikram Patel",
        publishDate: new Date(currentDate.getTime() - 4 * 86400000),
        pageType: "article",
        readingTime: 12,
        language: "en",
        keywords: ["Digital Art", "AI Art", "Indian Culture", "Modern Art"],
        wordCount: 1500,
        imageCount: 10,
        linkCount: 8,
      },
      importance: 4,
      timesAccessed: 9,
      concepts: ["AI in Art", "Digital Creation", "Cultural Heritage"],
      category: "art",
    },
    {
      id: crypto.randomUUID(),
      url: "https://yourstory.com/startup-india-success",
      title: "Indian Startup Ecosystem: A Success Story",
      content:
        "The Indian startup ecosystem has grown exponentially in the last decade. From unicorns like Zerodha, CRED, and Razorpay to innovative solutions in healthtech and edtech, Indian entrepreneurs are solving unique local challenges with global potential...",
      captureMethod: "manual" as const,
      timestamp: new Date(Date.now() - 86400000), // 1 day ago
      metadata: {
        author: "Priya Mehta",
        publishDate: new Date(Date.now() - 86400000),
        pageType: "article" as const,
        readingTime: 10,
        language: "en",
        keywords: [
          "Indian Startups",
          "Entrepreneurship",
          "Innovation",
          "Digital India",
        ],
        wordCount: 1200,
        imageCount: 5,
        linkCount: 8,
      },
    },
    {
      id: crypto.randomUUID(),
      url: "https://www.digitalindia.gov.in/success-stories",
      title: "Digital India: Transforming Bharat Through Technology",
      content:
        "Digital India initiative has revolutionized how citizens interact with government services. From UPI payments to DigiLocker and CoWIN, technology is making public services more accessible and efficient. Rural India is witnessing digital transformation through initiatives like BharatNet...",
      captureMethod: "manual" as const,
      timestamp: new Date(Date.now() - 172800000), // 2 days ago
      metadata: {
        author: "Amit Patel",
        publishDate: new Date(Date.now() - 172800000),
        pageType: "article" as const,
        readingTime: 12,
        language: "en",
        keywords: [
          "Digital India",
          "E-governance",
          "UPI",
          "Digital Transformation",
        ],
        wordCount: 1500,
        imageCount: 6,
        linkCount: 10,
      },
    },
    {
      id: crypto.randomUUID(),
      url: "https://www.cleantechinindia.in/renewable-energy",
      title: "India's Renewable Energy Revolution",
      content:
        "India is making significant strides in renewable energy adoption. With ambitious targets for solar and wind energy, the country is positioning itself as a global leader in clean energy. Projects like the International Solar Alliance and large-scale solar parks are transforming the energy landscape...",
      captureMethod: "manual" as const,
      timestamp: new Date(Date.now() - 259200000), // 3 days ago
      metadata: {
        author: "Sunita Rao",
        publishDate: new Date(Date.now() - 259200000),
        pageType: "article" as const,
        readingTime: 15,
        language: "en",
        keywords: [
          "Renewable Energy",
          "Solar Power",
          "Clean Energy",
          "Sustainability",
        ],
        wordCount: 1800,
        imageCount: 8,
        linkCount: 12,
      },
    },
    {
      id: crypto.randomUUID(),
      url: "https://www.cultureofindia.net/festivals",
      title: "Celebrating India's Cultural Heritage",
      content:
        "India's rich cultural tapestry is woven with diverse festivals, traditions, and customs. From the colorful celebrations of Holi to the spiritual significance of Diwali, each festival tells a unique story. The various art forms, classical dances, and musical traditions continue to thrive in modern India...",
      captureMethod: "manual" as const,
      timestamp: new Date(Date.now() - 345600000), // 4 days ago
      metadata: {
        author: "Maya Iyer",
        publishDate: new Date(Date.now() - 345600000),
        pageType: "article" as const,
        readingTime: 9,
        language: "en",
        keywords: ["Indian Culture", "Festivals", "Traditions", "Heritage"],
        wordCount: 1000,
        imageCount: 10,
        linkCount: 8,
      },
    },
    {
      id: crypto.randomUUID(),
      url: "https://www.nature.com/articles/india-biodiversity",
      title: "Biodiversity Hotspots of India: A Scientific Study",
      content:
        "India's rich biodiversity spans from the Himalayas to the Western Ghats. Recent research indicates over 45,000 plant species and 91,000 animal species. Conservation efforts in regions like the Sundarbans and Silent Valley are showing promising results in protecting endangered species...",
      captureMethod: "manual" as const,
      timestamp: new Date(Date.now() - 432000000), // 5 days ago
      metadata: {
        author: "Dr. Rajesh Kumar",
        publishDate: new Date(Date.now() - 432000000),
        pageType: "documentation" as const,
        readingTime: 20,
        language: "en",
        keywords: ["Biodiversity", "Conservation", "Wildlife", "Research"],
        wordCount: 2500,
        imageCount: 15,
        linkCount: 25,
      },
    },
    {
      id: crypto.randomUUID(),
      url: "https://www.youtube.com/watch?v=indian-space-program",
      title: "ISRO's Journey to Mars: The Mangalyaan Story",
      content:
        "Documentary exploring India's historic Mars Orbital Mission. From the initial conception to becoming the first Asian nation to reach Mars orbit, and the first nation worldwide to do so in its first attempt. Featuring interviews with key scientists and behind-the-scenes footage...",
      captureMethod: "manual" as const,
      timestamp: new Date(Date.now() - 518400000), // 6 days ago
      metadata: {
        author: "Science Today Channel",
        publishDate: new Date(Date.now() - 518400000),
        pageType: "video" as const,
        readingTime: 45,
        language: "en",
        keywords: ["ISRO", "Space Science", "Mangalyaan", "Technology"],
        wordCount: 0,
        imageCount: 1,
        linkCount: 3,
      },
    },
    {
      id: crypto.randomUUID(),
      url: "https://medium.com/@techie/bengaluru-tech-hub",
      title: "Inside Bengaluru's Tech Parks: The Silicon Valley of India",
      content:
        "A deep dive into Bengaluru's transformation into a global tech hub. From Electronic City to Whitefield, explore how technology parks are shaping India's IT landscape. Success stories of startups, multinational companies, and the vibrant tech culture that makes Bengaluru unique...",
      captureMethod: "manual" as const,
      timestamp: new Date(Date.now() - 604800000), // 7 days ago
      metadata: {
        author: "Arun Menon",
        publishDate: new Date(Date.now() - 604800000),
        pageType: "article" as const,
        readingTime: 12,
        language: "en",
        keywords: [
          "Bengaluru",
          "Technology Parks",
          "IT Industry",
          "Innovation",
        ],
        wordCount: 1800,
        imageCount: 8,
        linkCount: 15,
      },
    },
    {
      id: crypto.randomUUID(),
      url: "https://twitter.com/startupindia/status/latest-initiatives",
      title: "Startup India: New Policy Announcements",
      content:
        "Latest updates on Startup India initiatives. Tax benefits extended for startups registered until 2030. New funding schemes announced for deep-tech startups. Special focus on women entrepreneurs and rural innovation...",
      captureMethod: "manual" as const,
      timestamp: new Date(Date.now() - 691200000), // 8 days ago
      metadata: {
        author: "Startup India",
        publishDate: new Date(Date.now() - 691200000),
        pageType: "social" as const,
        readingTime: 5,
        language: "en",
        keywords: [
          "Startup Policy",
          "Government Initiative",
          "Innovation",
          "Entrepreneurship",
        ],
        wordCount: 300,
        imageCount: 2,
        linkCount: 4,
      },
    },
    {
      id: crypto.randomUUID(),
      url: "https://dev.to/indiantech/building-scalable-systems",
      title: "Building Scalable Systems: Lessons from Indian Tech Giants",
      content:
        "Technical deep-dive into how Indian tech companies handle massive scale. Case studies from PhonePe processing millions of UPI transactions, Swiggy's real-time delivery system, and Aadhaar's biometric system handling over a billion users...",
      captureMethod: "manual" as const,
      timestamp: new Date(Date.now() - 777600000), // 9 days ago
      metadata: {
        author: "Vikram Singh",
        publishDate: new Date(Date.now() - 777600000),
        pageType: "documentation" as const,
        readingTime: 25,
        language: "en",
        keywords: [
          "System Design",
          "Scalability",
          "Architecture",
          "Tech Infrastructure",
        ],
        wordCount: 3000,
        imageCount: 12,
        linkCount: 18,
      },
    },
  ];

  // Add each sample content item
  for (const content of sampleContent) {
    await store.create(content);
  }
}

// Add relationships between content
async function addSampleRelationships() {
  const relationshipStore = (
    await import("../storage/relationshipStore")
  ).RelationshipStore.getInstance();

  // Get all content IDs
  const store = ContentStore.getInstance();
  const allContent = await store.list();
  const contents = allContent.data || [];

  if (contents.length < 2) return;

  // Create a map of content titles to IDs for safer lookup
  const contentMap = new Map(
    contents.map((content) => [content.title, content.id])
  );

  // Create meaningful relationships between content
  const relationships = [
    {
      sourceId: contentMap.get("AI Revolution in Indian Tech Industry") || "",
      targetId:
        contentMap.get("AI in Indian Digital Art: A New Renaissance") || "",
      type: "related" as const,
      strength: 0.8,
      confidence: 0.9,
      metadata: {
        reason: "AI technology applications",
        keywords: ["AI", "Technology", "Innovation"],
      },
    },
    {
      sourceId:
        contentMap.get("Sustainable Development Initiatives in India") || "",
      targetId:
        contentMap.get("Modern Indian Fusion Cuisine: A Culinary Journey") ||
        "",
      type: "related" as const,
      strength: 0.6,
      confidence: 0.7,
      metadata: {
        reason: "Sustainability in food industry",
        keywords: ["Sustainability", "Food", "Innovation"],
      },
    },
    {
      sourceId:
        contentMap.get("AI in Indian Digital Art: A New Renaissance") || "",
      targetId:
        contentMap.get("Modern Indian Fusion Cuisine: A Culinary Journey") ||
        "",
      type: "references" as const,
      strength: 0.5,
      confidence: 0.8,
      metadata: {
        reason: "Cultural heritage in modern context",
        keywords: ["Culture", "Heritage", "Innovation"],
      },
    },
    {
      sourceId: contentMap.get("AI Revolution in Indian Tech Industry") || "",
      targetId:
        contentMap.get("Sustainable Development Initiatives in India") || "",
      type: "builds_on" as const,
      strength: 0.7,
      description: "AI adoption in Indian startups",
    },
    {
      sourceId:
        contentMap.get("Indian Startup Ecosystem: A Success Story") || "",
      targetId:
        contentMap.get(
          "Digital India: Transforming Bharat Through Technology"
        ) || "",
      type: "builds_on" as const,
      strength: 0.9,
      description: "Digital infrastructure enabling startup growth",
    },
    {
      sourceId:
        contentMap.get(
          "Digital India: Transforming Bharat Through Technology"
        ) || "",
      targetId: contentMap.get("India's Renewable Energy Revolution") || "",
      type: "related" as const,
      strength: 0.7,
      description: "Digital solutions for energy management",
    },
    {
      sourceId:
        contentMap.get("Biodiversity Hotspots of India: A Scientific Study") ||
        "",
      targetId: contentMap.get("India's Renewable Energy Revolution") || "",
      type: "related" as const,
      strength: 0.85,
      description: "Environmental sustainability connection",
    },
    {
      sourceId:
        contentMap.get("ISRO's Journey to Mars: The Mangalyaan Story") || "",
      targetId: contentMap.get("AI Revolution in Indian Tech Industry") || "",
      type: "references" as const,
      strength: 0.75,
      description: "AI applications in space research",
    },
    {
      sourceId:
        contentMap.get(
          "Inside Bengaluru's Tech Parks: The Silicon Valley of India"
        ) || "",
      targetId:
        contentMap.get("Indian Startup Ecosystem: A Success Story") || "",
      type: "related" as const,
      strength: 0.95,
      description: "Major startup hub location",
    },
    {
      sourceId: contentMap.get("Startup India: New Policy Announcements") || "",
      targetId:
        contentMap.get(
          "Inside Bengaluru's Tech Parks: The Silicon Valley of India"
        ) || "",
      type: "builds_on" as const,
      strength: 0.8,
      description: "Policy impact on tech hubs",
    },
    {
      sourceId:
        contentMap.get(
          "Building Scalable Systems: Lessons from Indian Tech Giants"
        ) || "",
      targetId:
        contentMap.get(
          "Digital India: Transforming Bharat Through Technology"
        ) || "",
      type: "builds_on" as const,
      strength: 0.9,
      description: "Technical foundation for digital initiatives",
    },
  ];

  // Add relationships
  for (const rel of relationships) {
    if (rel.sourceId && rel.targetId) {
      // Only create relationship if both IDs exist
      const relationship: ContentRelationship = {
        id: crypto.randomUUID(),
        sourceId: rel.sourceId,
        targetId: rel.targetId,
        type: rel.type,
        strength: rel.strength,
        confidence: 0.95,
        createdAt: new Date(),
        lastUpdated: new Date(),
      };
      await relationshipStore.create(relationship);
    }
  }
}

// Export for use in dashboard
export { addSampleContent, addSampleRelationships };
